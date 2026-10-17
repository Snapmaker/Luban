import { ChildProcess, spawn } from 'child_process';
import http from 'http';

import logger from '../../lib/logger';
import config from '../configstore';
import {
    CAPTURE_TIMEOUT_MS,
    CapturedFrame,
    FFMPEG_PROVIDER,
    LiveFrameSource,
    cacheFrame,
    captureFrame,
    fetchHttpSnapshot,
    ffmpegBinary,
    isCameraConfigured,
    noteCameraLastGood,
    oneShotCapturePending,
    resolveFfmpegInput,
    setLiveFrameSource,
} from './camera';
import {
    FrameHub,
    JpegFrameSplitter,
    MAX_MAX_CLIENTS,
    MAX_STREAM_FPS,
    MIN_STREAM_FPS,
    MJPEG_BOUNDARY,
    backoffMs,
    clampFps,
    clampMaxClients,
    resolveStreamEnabled,
} from './mjpegFanout';
import { resolveTelemetryConfig } from './telemetryConfig';

const log = logger('service:mcp:camera-stream');

// Live MJPEG view of the toolhead camera for the OPERATOR, served by the MCP
// http server (same port, same LAN gate as /mcp and /confirm):
//   GET /camera               tiny HTML page showing the stream
//   GET /camera/stream.mjpeg  multipart/x-mixed-replace, capped fps
//   GET /camera/snapshot.jpg  one JPEG (the same capture path the tools use)
//   GET /camera/status.json   loop / client / freshness state
//
// One capture loop owns the device while there are stream clients (v4l2 and
// DirectShow devices open for one process only): a long-lived ffmpeg writing
// MJPEG to a pipe (or, for mcpCameraUrl, a poller of the snapshot URL). Every
// frame goes to the FrameHub, which fans it out to the browsers AND serves
// MCP captures (capture_frame, move_and_capture, visual_servo, survey_bed)
// through camera.ts's LiveFrameSource hook - so the tools keep working while
// someone watches, and go back to opening the device themselves when the
// last client leaves (after a short linger). The loop is a separate process
// and the parsing is a marker walk over the pipe, so it never blocks the
// event loop's heartbeat or motion handling; a dying process is logged and
// restarted with backoff while the last frame stays available, flagged stale.
export const STREAM_ENABLED_ENV = 'LUBAN_MCP_CAMERA_STREAM_ENABLED';
export const STREAM_ENABLED_KEY = 'mcpCameraStreamEnabled';
export const STREAM_FPS_KEY = 'mcpCameraStreamFps';
export const STREAM_MAX_CLIENTS_KEY = 'mcpCameraStreamMaxClients';
export { MIN_STREAM_FPS, MAX_STREAM_FPS, MAX_MAX_CLIENTS };

const LINGER_MS = 5000;
const KILL_GRACE_MS = 2000;
const JPEG_QUALITY = '4';

export interface CameraStreamUrls {
    page: string;
    stream: string;
    snapshot: string;
}

export interface CameraStreamSettings {
    enabled: boolean;
    source: 'env' | 'config' | 'default';
    fps: number;
    maxClients: number;
    /** What is stored (undefined = following the default). */
    stored: { enabled: unknown; fps: unknown; maxClients: unknown };
    cameraConfigured: boolean;
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string));
}

// Spindle telemetry panel beside the stream (telemetry.ts / spindleTelemetry.ts):
// shown only when mcpSpindleTelemetry is on, fed by /telemetry/live.json at
// 1 Hz - RPM (microphone when tracked, else the controller's report) against
// the commanded S, the noise level, the chatter index, and two-minute
// sparklines with dips below 97 % of S in red and chatter peaks in orange.
const PANEL_CSS = `#wrap{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
#view{flex:1 1 480px;min-width:280px}
#tele{flex:0 0 320px;max-width:100%;font-size:13px;background:#181818;border:1px solid #333;padding:10px;border-radius:4px}
#tele h3{margin:0 0 6px;font-size:14px;color:#9cf}
#tele .big{font-size:26px;font-family:monospace;color:#eee;line-height:1.1}
#tele .lbl{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
#tele .row{display:flex;justify-content:space-between;gap:8px;margin:6px 0 2px}
#tele svg{width:100%;height:46px;display:block;background:#0d0d0d;border:1px solid #2a2a2a}
#tele canvas{width:100%;height:96px;display:block;background:#0d0d0d;border:1px solid #2a2a2a;image-rendering:pixelated}
#tele .warn{color:#f77}#tele .ok{color:#7c7}#tele .dim{color:#777}`;
const PANEL_HTML = '<aside id="tele"><h3>Spindle telemetry</h3><div id="tele-body" class="dim">waiting for a file job...</div>'
    + '<div class="lbl" id="tele-wf-lbl" style="display:none;margin-top:6px">spectrogram, last 5 min: 30 Hz (bottom) - 8 kHz, log; '
    + 'brightness = dB over the frame median; cyan = spindle 1x / 4x, pink = gantry tone</div>'
    + '<canvas id="tele-wf" width="300" height="96" style="display:none"></canvas></aside>';
const PANEL_JS = `(function(){
  var body=document.getElementById('tele-body');
  if(!body){return;}
  function fmt(v,d){return (v==null||isNaN(v))?'-':Number(v).toFixed(d||0);}
  var wf=document.getElementById('tele-wf'),wfl=document.getElementById('tele-wf-lbl'),wfCtx=wf?wf.getContext('2d'):null,wfLast=null;
  function wfRow(hz){return 95-Math.round(Math.log(Math.max(30,Math.min(8000,hz))/30)/Math.log(8000/30)*95);}
  function waterfall(sp,rpm,motionHz,stamp){
    // One 1 px column per new audio frame: a scrolling log-frequency spectrogram, each column
    // scaled to its own median so comb lines stand out at any overall level (octave-band bars
    // saturated as soon as the cut or the gantry got loud).
    if(!wfCtx||!sp||!sp.db||sp.db.length<96){return;}
    if(stamp===wfLast){return;}wfLast=stamp;
    wf.style.display='block';wfl.style.display='block';
    wfCtx.drawImage(wf,-1,0);
    var vals=sp.db.slice().sort(function(a,b){return a-b;}),med=vals[vals.length>>1];
    var img=wfCtx.createImageData(1,96);
    for(var i=0;i<96;i++){var r=Math.max(0,Math.min(1,(sp.db[i]-med)/30)),o=(95-i)*4;
      img.data[o]=Math.round(255*r*r);img.data[o+1]=Math.round(220*r);img.data[o+2]=Math.round(40+90*(1-r));img.data[o+3]=255;}
    wfCtx.putImageData(img,299,0);
    if(rpm){wfCtx.fillStyle='#4ff';wfCtx.fillRect(299,wfRow(rpm/60),1,1);wfCtx.fillRect(299,wfRow(rpm/15),1,1);}
    if(motionHz){wfCtx.fillStyle='#f6f';wfCtx.fillRect(299,wfRow(motionHz),1,1);}
  }
  function spark(s,opt){
    // Polyline of s.v over s.t; points failing opt.bad(v) get a red dot, opt.hot(v) an orange one.
    if(!s||!s.t||s.t.length<2){return '<svg viewBox="0 0 300 46"></svg>';}
    var t0=s.t[0],t1=s.t[s.t.length-1]||t0+1,lo=opt.min,hi=opt.max,vals=[];
    for(var i=0;i<s.v.length;i++){if(s.v[i]!=null&&!isNaN(s.v[i]))vals.push(s.v[i]);}
    if(!vals.length){return '<svg viewBox="0 0 300 46"></svg>';}
    if(lo==null){lo=Math.min.apply(null,vals);}if(hi==null){hi=Math.max.apply(null,vals);}
    if(hi-lo<1e-6){hi=lo+1;}
    var pts=[],dots='';
    for(var j=0;j<s.t.length;j++){var v=s.v[j];if(v==null||isNaN(v)){continue;}
      var x=((s.t[j]-t0)/(t1-t0||1))*298+1,y=45-((Math.min(hi,Math.max(lo,v))-lo)/(hi-lo))*42;
      pts.push(x.toFixed(1)+','+y.toFixed(1));
      if(opt.bad&&opt.bad(v)){dots+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2" fill="#f44"/>';}
      else if(opt.hot&&opt.hot(v)){dots+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2" fill="#fa3"/>';}}
    var ref='';
    if(opt.ref!=null&&opt.ref>=lo&&opt.ref<=hi){var ry=45-((opt.ref-lo)/(hi-lo))*42;ref='<line x1="1" x2="299" y1="'+ry.toFixed(1)+'" y2="'+ry.toFixed(1)+'" stroke="#465" stroke-dasharray="3 3"/>';}
    return '<svg viewBox="0 0 300 46" preserveAspectRatio="none">'+ref+'<polyline fill="none" stroke="'+(opt.color||'#9cf')+'" stroke-width="1.2" points="'+pts.join(' ')+'"/>'+dots+'</svg>';
  }
  function render(d){
    if(!d||!d.enabled){body.className='dim';body.textContent='spindle telemetry is off (Settings -> MCP Server)';return;}
    var s=d.session;
    if(!s){body.className='dim';body.textContent='enabled - waiting for a file job to start'+(d.audioEnabled?' (mic: '+(d.audioDevice||'none')+')':'');return;}
    var st=s.status||{},au=s.audio||{},cmd=st.commandedS,h='';
    var rpm=(au.rpm!=null&&!isNaN(au.rpm))?au.rpm:st.rpm,src=(au.rpm!=null&&!isNaN(au.rpm))?'mic':'status';
    var pct=(cmd&&rpm)?(100*rpm/cmd):null,cls=(pct==null)?'':(pct<95?'warn':(pct<97?'':'ok'));
    h+='<div class="lbl">'+s.jobName+' &middot; '+s.state+' &middot; t+'+fmt(s.tNowMs/1000,0)+' s</div>';
    h+='<div class="row"><div><div class="lbl">RPM ('+src+')</div><div class="big '+cls+'">'+fmt(rpm,0)+'</div></div>'
      +'<div><div class="lbl">commanded S</div><div class="big">'+fmt(cmd,0)+'</div></div>'
      +'<div><div class="lbl">load</div><div class="big '+cls+'">'+(pct==null?'-':fmt(pct,1)+'%')+'</div></div></div>';
    h+='<div class="lbl">rpm, last 2 min (red: below 97 % of S; dashed: S)</div>';
    var sp=s.spark||{},ss=sp.status||{},sa=sp.audio||{};
    h+=spark(sa.rpm||ss.rpm,{min:cmd?cmd*0.85:null,max:cmd?cmd*1.05:null,ref:cmd,bad:function(v){return cmd&&v<0.97*cmd;},color:'#9cf'});
    h+='<div class="row"><div><div class="lbl">noise (dBFS)</div><div class="big">'+fmt(au.levelDb,0)+'</div></div>'
      +'<div><div class="lbl">chatter idx (dB)</div><div class="big '+(au.chatterDb>12?'warn':'')+'">'+fmt(au.chatterDb,0)+'</div></div>'
      +'<div><div class="lbl">line</div><div class="big">'+fmt(st.line,0)+'</div></div></div>';
    h+='<div class="row"><div><div class="lbl">gantry / frame tone</div><div class="big">'+fmt(au.motionHz,0)+' Hz</div></div>'
      +'<div><div class="lbl">its level (dB)</div><div class="big">'+fmt(au.motionDb,0)+'</div></div>'
      +'<div><div class="lbl">spindle 1x</div><div class="big">'+(rpm?fmt(rpm/60,0):'-')+' Hz</div></div></div>';
    h+='<div class="lbl">motion tone, last 2 min (Hz; the spindle is masked out of this fit)</div>'+spark(sa.motionHz,{min:0,max:400,color:'#c9c'});
    waterfall(s.spectrum,src==='mic'?rpm:null,au.motionHz,au.t);
    h+='<div class="lbl">noise level, last 2 min</div>'+spark(sa.levelDb,{min:-80,max:0,color:'#8c8'});
    h+='<div class="lbl">chatter index (orange: &gt; 12 dB over the band)</div>'+spark(sa.chatterDb,{min:0,max:30,ref:12,hot:function(v){return v>12;},color:'#ca8'});
    var ev=s.events||{},flags=[];['spindle_sag','spindle_blip','spindle_reach','chatter','runout','spindle_nolock'].forEach(function(k){if(ev[k])flags.push(k+' x'+ev[k]);});
    h+='<div class="lbl" style="margin-top:6px">events: '+(flags.length?'<span class="warn">'+flags.join(', ')+'</span>':'none')+(au.device?' &middot; mic '+au.device:'')+(au.error?' &middot; <span class="warn">'+au.error+'</span>':'')+'</div>';
    body.className='';body.innerHTML=h;
  }
  function poll(){fetch('/telemetry/live.json',{cache:'no-store'}).then(function(r){return r.json()}).then(render).catch(function(){body.className='dim';body.textContent='telemetry unavailable';});}
  poll();setInterval(poll,1000);
})();`;

function pageHtml(urls: CameraStreamUrls, fps: number, telemetry: boolean): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Luban MCP camera</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:sans-serif;background:#111;color:#ddd;margin:0;padding:12px}
img{max-width:100%;height:auto;display:block;background:#000;border:1px solid #333}
#status{font-size:13px;color:#aaa;margin:8px 0;font-family:monospace;white-space:pre-wrap}
a{color:#7ab}
${telemetry ? PANEL_CSS : ''}
</style></head><body>
<nav style="margin-bottom:12px"><a href="/jobs">Jobs</a></nav>
<div id="wrap"><div id="view">
<img id="stream" src="${escapeHtml(urls.stream)}" alt="camera stream">
<div id="status">connecting...</div>
<div><a href="${escapeHtml(urls.snapshot)}" target="_blank">snapshot.jpg</a> &middot;
<a href="${escapeHtml(urls.page.replace(/\/camera$/, '/camera/status.json'))}" target="_blank">status.json</a> &middot;
capped at ${fps} fps &middot; MCP tool captures are served from this same stream while it runs.</div>
</div>${telemetry ? PANEL_HTML : ''}</div>
<script>${telemetry ? PANEL_JS : ''}
(function(){
  var el=document.getElementById('status');
  function poll(){
    fetch('${escapeHtml(urls.page.replace(/\/camera$/, '/camera/status.json'))}',{cache:'no-store'}).then(function(r){return r.json()}).then(function(s){
      el.textContent=(s.running?'live':'not running')+' | clients '+s.clients+' | frame age '+(s.frameAgeMs==null?'-':s.frameAgeMs+' ms')
        +(s.stale?' STALE':'')+' | '+(s.provider||'')+' '+(s.device||'')+(s.lastError?'\\nlast error: '+s.lastError:'');
    }).catch(function(){el.textContent='status unavailable'});
  }
  poll();setInterval(poll,3000);
  var img=document.getElementById('stream');
  img.onerror=function(){setTimeout(function(){img.src='${escapeHtml(urls.stream)}?r='+Date.now()},3000)};
})();
</script></body></html>`;
}

class CameraStreamService implements LiveFrameSource {
    private baseUrl: () => string = () => 'http://127.0.0.1:40889';

    private hub: FrameHub | null = null;

    private streamClients = new Map<number, http.ServerResponse>();

    private child: ChildProcess | null = null;

    private httpPollTimer: ReturnType<typeof setTimeout> | null = null;

    private httpPolling = false;

    private restartTimer: ReturnType<typeof setTimeout> | null = null;

    private lingerTimer: ReturnType<typeof setTimeout> | null = null;

    private starting = false;

    private attempt = 0;

    private lastError: string | null = null;

    private device: string | null = null;

    private provider: string | null = null;

    private stderrTail: string[] = [];

    private startedAt: number | null = null;

    public start(baseUrl: () => string): void {
        this.baseUrl = baseUrl;
        setLiveFrameSource(this);
    }

    public shutdown(): void {
        this.disconnectClients('MCP service stopping');
        this.stopLoop('service stopped');
        setLiveFrameSource(null);
    }

    // ---- settings -------------------------------------------------------

    public settings(): CameraStreamSettings {
        const enabled = resolveStreamEnabled({
            env: process.env[STREAM_ENABLED_ENV],
            stored: config.get(STREAM_ENABLED_KEY),
            cameraConfigured: isCameraConfigured(),
        });
        return {
            enabled: enabled.enabled,
            source: enabled.source,
            fps: clampFps(config.get(STREAM_FPS_KEY)),
            maxClients: clampMaxClients(config.get(STREAM_MAX_CLIENTS_KEY)),
            stored: {
                enabled: config.get(STREAM_ENABLED_KEY),
                fps: config.get(STREAM_FPS_KEY),
                maxClients: config.get(STREAM_MAX_CLIENTS_KEY),
            },
            cameraConfigured: isCameraConfigured(),
        };
    }

    public isEnabled(): boolean {
        return this.settings().enabled;
    }

    /**
     * Settings changed (Settings -> MCP Server -> Camera, saved through
     * api-mcp.js): re-read the configstore now. Off = every stream client is
     * disconnected and the loop stops; fps / client cap apply to the next
     * loop start (the hub is rebuilt once no client is attached).
     */
    public applySettings(): void {
        if (!this.isEnabled()) {
            this.disconnectClients('camera stream disabled in Settings');
            this.stopLoop('disabled');
        }
        if (this.hub && !this.hub.hasClients() && this.hub.pendingWaiters === 0 && !this.loopAlive()) {
            this.hub = null;
        }
    }

    /**
     * The selected camera changed (select_camera): the loop is holding the
     * OLD device and would go on feeding its frames to every capture, so it
     * is stopped here and started again - on the new device, which startLoop
     * re-reads from the configstore - for whoever is still watching.
     */
    public reselectDevice(reason: string): boolean {
        const wasRunning = this.loopAlive();
        this.stopLoop(reason);
        this.device = null;
        this.provider = null;
        if (this.hub && this.hub.hasClients() && this.isEnabled()) {
            this.ensureLoop();
        }
        return wasRunning;
    }

    public urls(): CameraStreamUrls {
        const base = this.baseUrl();
        return { page: `${base}/camera`, stream: `${base}/camera/stream.mjpeg`, snapshot: `${base}/camera/snapshot.jpg` };
    }

    public status() {
        const settings = this.settings();
        const hub = this.hub;
        const urls = this.urls();
        return {
            enabled: settings.enabled,
            source: settings.source,
            fps: settings.fps,
            storedFps: settings.stored.fps === undefined ? null : settings.stored.fps,
            maxClients: settings.maxClients,
            pageUrl: settings.enabled ? urls.page : null,
            streamUrl: settings.enabled ? urls.stream : null,
            snapshotUrl: settings.enabled ? urls.snapshot : null,
            running: this.loopAlive(),
            starting: this.starting,
            restartPending: !!this.restartTimer,
            restartAttempt: this.attempt,
            clients: this.streamClients.size,
            provider: this.provider,
            device: this.device,
            lastFrameAt: hub && hub.latest ? hub.latest.capturedAt : null,
            frameAgeMs: hub ? hub.ageMs() : null,
            stale: hub ? hub.isStale() : true,
            lastError: this.lastError,
            startedAt: this.startedAt,
            stats: hub ? hub.stats : null,
        };
    }

    // ---- LiveFrameSource (camera.ts) --------------------------------------

    public isActive(): boolean {
        return this.loopAlive() || this.starting;
    }

    /** Which device the loop holds right now (LiveFrameSource): null when it holds none. */
    public activeDevice(): string | null {
        return this.loopAlive() ? this.device : null;
    }

    public async awaitFrame(): Promise<CapturedFrame> {
        const hub = this.getHub();
        const frameIntervalMs = Math.round(1000 / this.settings().fps);
        const live = await hub.awaitFrame(frameIntervalMs + 150, CAPTURE_TIMEOUT_MS);
        return {
            frameId: cacheFrame(live.jpg, this.device),
            imageBase64: live.jpg.toString('base64'),
            mimeType: 'image/jpeg',
            provider: this.provider || FFMPEG_PROVIDER,
            device: this.device,
            capturedAt: live.capturedAt,
            source: 'stream',
        };
    }

    // ---- http routes --------------------------------------------------------

    /** Handle /camera* requests; index.ts has already applied the LAN gate. */
    public handleRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
        const { pathname } = url;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            res.end();
            return;
        }
        if (!this.isEnabled()) {
            const text = 'Camera stream is off. Turn it on under Settings -> MCP Server -> Camera '
                + `(configstore ${STREAM_ENABLED_KEY}; env ${STREAM_ENABLED_ENV} overrides).\n`;
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(text);
            return;
        }
        if (pathname === '/camera' || pathname === '/camera/') {
            // Relative paths preserve the browser's HTTP/HTTPS origin, including the port.
            const telemetry = resolveTelemetryConfig(process.env, (key) => config.get(key)).enabled;
            const body = pageHtml({ page: '/camera', stream: '/camera/stream.mjpeg', snapshot: '/camera/snapshot.jpg' }, this.settings().fps, telemetry);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : body);
            return;
        }
        if (pathname === '/camera/status.json') {
            const body = JSON.stringify(this.status());
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : body);
            return;
        }
        if (pathname === '/camera/stream.mjpeg') {
            this.handleStream(req, res);
            return;
        }
        if (pathname === '/camera/snapshot.jpg') {
            this.handleSnapshot(req, res);
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found', routes: ['/camera', '/camera/stream.mjpeg', '/camera/snapshot.jpg', '/camera/status.json'] }));
    }

    private handleStream(req: http.IncomingMessage, res: http.ServerResponse): void {
        const hub = this.getHub();
        if (hub.isFull()) {
            res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '5' });
            res.end(`Too many stream clients (${this.settings().maxClients}). Close another view and retry.\n`);
            return;
        }
        // Head first: subscribe() writes the latest frame straight away when
        // there is one, and a write before writeHead would send default headers.
        res.writeHead(200, {
            'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Connection: 'close',
            'X-Accel-Buffering': 'no',
        });
        const subscription = hub.subscribe({ write: (chunk: Buffer) => res.write(chunk) });
        if (!subscription) {
            res.end();
            return;
        }
        this.streamClients.set(subscription.id, res);
        if (this.lingerTimer) {
            clearTimeout(this.lingerTimer);
            this.lingerTimer = null;
        }
        res.on('drain', () => hub.markDrained(subscription.id));
        const gone = () => {
            if (!this.streamClients.has(subscription.id)) {
                return;
            }
            subscription.unsubscribe();
            this.streamClients.delete(subscription.id);
            log.info(`Stream client left (${this.streamClients.size} remaining)`);
            if (!hub.hasClients()) {
                this.scheduleLingerStop();
            }
        };
        res.on('close', gone);
        res.on('error', gone);
        req.on('close', gone);
        log.info(`Stream client from ${req.socket.remoteAddress} (${this.streamClients.size} total)`);
        this.ensureLoop();
    }

    private async handleSnapshot(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // The same path the tools take: the live loop's next frame while it
        // runs, a one-shot capture otherwise. Falls back to the last frame,
        // flagged stale, when the loop is alive but not producing.
        try {
            const frame = await captureFrame();
            const body = Buffer.from(frame.imageBase64, 'base64');
            res.writeHead(200, {
                'Content-Type': frame.mimeType,
                'Content-Length': body.length,
                'Cache-Control': 'no-store',
                'X-Frame-Captured-At': String(frame.capturedAt),
                'X-Frame-Source': frame.source,
                'X-Frame-Id': frame.frameId,
            });
            res.end(req.method === 'HEAD' ? undefined : body);
        } catch (err) {
            const latest = this.hub && this.hub.latest;
            if (latest) {
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': latest.jpg.length,
                    'Cache-Control': 'no-store',
                    'X-Frame-Captured-At': String(latest.capturedAt),
                    'X-Frame-Source': 'stream',
                    'X-Frame-Stale': 'true',
                    'X-Frame-Error': String((err as Error).message).replace(/[\r\n]+/g, ' ').slice(0, 200),
                });
                res.end(req.method === 'HEAD' ? undefined : latest.jpg);
                return;
            }
            res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(`${(err as Error).message}\n`);
        }
    }

    private disconnectClients(reason: string): void {
        if (this.streamClients.size) {
            log.info(`Disconnecting ${this.streamClients.size} stream client(s): ${reason}`);
        }
        for (const [id, res] of this.streamClients) {
            this.streamClients.delete(id);
            if (this.hub) {
                this.hub.unsubscribe(id);
            }
            try {
                res.end();
                res.socket && res.socket.destroy();
            } catch (err) {
                // already gone
            }
        }
    }

    // ---- capture loop -------------------------------------------------------

    private getHub(): FrameHub {
        if (!this.hub) {
            const settings = this.settings();
            const interval = Math.round(1000 / settings.fps);
            this.hub = new FrameHub({
                maxClients: settings.maxClients,
                // A hair under the source interval so jitter never halves the rate.
                minIntervalMs: Math.max(0, interval - 20),
                staleAfterMs: Math.max(3000, interval * 3),
            });
        }
        return this.hub;
    }

    private loopAlive(): boolean {
        return this.child !== null || this.httpPolling;
    }

    private scheduleLingerStop(): void {
        if (this.lingerTimer) {
            clearTimeout(this.lingerTimer);
        }
        this.lingerTimer = setTimeout(() => {
            this.lingerTimer = null;
            if (this.hub && this.hub.hasClients()) {
                return;
            }
            if (this.hub && this.hub.pendingWaiters > 0) {
                // An MCP capture is waiting on the next frame: let it land first.
                this.scheduleLingerStop();
                return;
            }
            this.stopLoop('no stream clients');
        }, LINGER_MS);
    }

    private ensureLoop(): void {
        if (this.loopAlive() || this.starting || this.restartTimer) {
            return;
        }
        this.starting = true;
        // A one-shot MCP capture may hold the device right now; let it finish.
        oneShotCapturePending().then(async () => {
            await this.startLoop();
        }).catch((err: Error) => {
            this.starting = false;
            this.noteFailure(`start failed: ${err.message}`);
        });
    }

    private async startLoop(): Promise<void> {
        try {
            if (!this.hub || !this.hub.hasClients() || !this.isEnabled()) {
                return;
            }
            const cameraUrl = config.get('mcpCameraUrl');
            if (cameraUrl) {
                this.provider = 'http';
                this.device = String(cameraUrl);
                this.startedAt = Date.now();
                this.httpPolling = true;
                this.pollHttp(String(cameraUrl));
                log.info(`Camera stream loop started: polling ${cameraUrl} at ${this.settings().fps} fps`);
                return;
            }
            const { device, inputArgs } = await resolveFfmpegInput();
            this.provider = FFMPEG_PROVIDER;
            this.device = device;
            this.spawnFfmpeg(inputArgs, device);
        } catch (err) {
            this.noteFailure((err as Error).message);
        } finally {
            this.starting = false;
        }
    }

    private spawnFfmpeg(inputArgs: string[], device: string): void {
        const fps = this.settings().fps;
        const args = [
            '-hide_banner', '-loglevel', 'error', '-nostdin',
            ...inputArgs,
            '-an', '-vf', `fps=${fps}`,
            '-f', 'mjpeg', '-q:v', JPEG_QUALITY,
            'pipe:1',
        ];
        let child: ChildProcess;
        try {
            child = spawn(ffmpegBinary(), args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        } catch (err) {
            this.noteFailure(`ffmpeg spawn failed: ${(err as Error).message}`);
            return;
        }
        this.child = child;
        this.startedAt = Date.now();
        this.stderrTail = [];
        const splitter = new JpegFrameSplitter();
        let gotFrame = false;
        log.info(`Camera stream loop started: ffmpeg ${FFMPEG_PROVIDER} "${device}" at ${fps} fps (pid ${child.pid})`);

        child.stdout && child.stdout.on('data', (chunk: Buffer) => {
            if (this.child !== child) {
                return;
            }
            for (const jpg of splitter.push(chunk)) {
                if (!gotFrame) {
                    gotFrame = true;
                    this.attempt = 0;
                    this.lastError = null;
                    noteCameraLastGood(device);
                }
                this.getHub().publish(jpg, Date.now());
            }
        });
        child.stderr && child.stderr.on('data', (chunk: Buffer) => {
            for (const line of String(chunk).split(/\r?\n/)) {
                if (line.trim()) {
                    this.stderrTail.push(line.trim());
                }
            }
            this.stderrTail = this.stderrTail.slice(-5);
        });
        child.on('error', (err: NodeJS.ErrnoException) => {
            if (this.child !== child) {
                return;
            }
            this.child = null;
            const text = err.code === 'ENOENT'
                ? `ffmpeg not found (${ffmpegBinary()}); set mcpFfmpegPath`
                : `ffmpeg error: ${err.message}`;
            this.noteFailure(text);
        });
        child.on('exit', (code, signal) => {
            if (this.child !== child) {
                return;
            }
            this.child = null;
            const detail = this.stderrTail.slice(-2).join(' ');
            this.noteFailure(`ffmpeg exited (${signal || `code ${code}`})${detail ? `: ${detail}` : ''}`);
        });
    }

    private pollHttp(url: string): void {
        if (!this.httpPolling) {
            return;
        }
        const interval = Math.round(1000 / this.settings().fps);
        const started = Date.now();
        fetchHttpSnapshot(url).then(({ body }) => {
            if (!this.httpPolling) {
                return;
            }
            this.attempt = 0;
            this.lastError = null;
            this.getHub().publish(body, Date.now());
            this.httpPollTimer = setTimeout(() => this.pollHttp(url), Math.max(0, interval - (Date.now() - started)));
        }).catch((err: Error) => {
            if (!this.httpPolling) {
                return;
            }
            this.lastError = `snapshot poll failed: ${err.message}`;
            const delay = backoffMs(this.attempt);
            this.attempt += 1;
            log.warn(`Camera stream ${this.lastError}; retrying in ${delay} ms`);
            this.httpPollTimer = setTimeout(() => this.pollHttp(url), delay);
        });
    }

    /** The loop died or would not start: log, keep the last frame, retry with backoff while wanted. */
    private noteFailure(text: string): void {
        this.lastError = text;
        const wanted = !!(this.hub && this.hub.hasClients()) && this.isEnabled();
        if (!wanted) {
            log.info(`Camera stream loop ended: ${text}`);
            if (this.hub) {
                this.hub.rejectWaiters(`Live camera stream stopped: ${text}`);
            }
            return;
        }
        const delay = backoffMs(this.attempt);
        this.attempt += 1;
        log.warn(`Camera stream loop failed (${text}); restarting in ${delay} ms (attempt ${this.attempt})`);
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
        }
        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            this.ensureLoop();
        }, delay);
    }

    private stopLoop(reason: string): void {
        if (this.lingerTimer) {
            clearTimeout(this.lingerTimer);
            this.lingerTimer = null;
        }
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        if (this.httpPollTimer) {
            clearTimeout(this.httpPollTimer);
            this.httpPollTimer = null;
        }
        this.httpPolling = false;
        const child = this.child;
        if (child) {
            this.child = null;
            log.info(`Camera stream loop stopping (${reason}); ending ffmpeg pid ${child.pid}`);
            try {
                child.kill();
            } catch (err) {
                // already gone
            }
            const grace = setTimeout(() => {
                try {
                    child.kill('SIGKILL');
                } catch (err) {
                    // already gone
                }
            }, KILL_GRACE_MS);
            child.once('exit', () => clearTimeout(grace));
        }
        this.attempt = 0;
        if (this.hub) {
            this.hub.rejectWaiters(`Live camera stream stopped (${reason}).`);
        }
    }
}

export const cameraStreamService = new CameraStreamService();
