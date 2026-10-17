/** Served from the MCP port; no app bundle, external assets or machine connection required. */
export const dashboardHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Luban jobs</title><link rel="manifest" href="/jobs/manifest.webmanifest"><meta name="theme-color" content="#10151d"><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#10151d;color:#edf1f7}
*{box-sizing:border-box}body{max-width:1080px;margin:auto;padding:24px}h1{margin:0;font-size:2rem}
header,nav,.row,.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap}header{justify-content:space-between}
a{color:#8fc7ff}button,select,a.button{font:inherit;border:1px solid #55677f;border-radius:8px;padding:10px 14px;background:#223146;color:#fff}
button,a.button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}.danger{background:#76282e;border-color:#db676f}
.panel,article{background:#192330;border:1px solid #344359;border-radius:12px;padding:18px;margin:14px 0}
.muted,time{color:#b1bfd1;font-size:.9rem}.badge{border-radius:20px;background:#334760;padding:4px 10px;font-size:.85rem}
article h3{margin:0;overflow-wrap:anywhere}.row{justify-content:space-between}.summary{overflow-wrap:anywhere}
.error{color:#ffb9bc}.empty{color:#a8b7ca;padding:10px 0}h2{font-size:1.25rem;margin-top:28px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;font-size:12px}
#toasts{position:fixed;bottom:16px;right:16px;max-width:min(420px,calc(100vw - 32px));z-index:2}
.toast{padding:14px;background:#254466;border:1px solid #79baff;border-radius:10px;margin-top:8px;box-shadow:0 6px 20px #0008}
.toast button{float:right;padding:2px 8px;margin-left:10px}#message{min-height:1.4em}details{margin-top:12px}
@media(max-width:600px){body{padding:14px}header{align-items:flex-start}article{padding:14px}.controls>*{flex:1;text-align:center}}
</style></head><body>
<header><div><p class="muted">LUBAN · JOB CONTROLLER</p><h1>Jobs</h1></div><nav><a id="pendant-link" class="button" href="http://localhost:40889/pendant" target="_blank" rel="noopener">USB pendant — Localhost ↗</a><a class="button" href="/camera" target="_blank" rel="noopener">Open camera ↗</a></nav></header>
<p id="connection" role="status">Connecting…</p>
<section class="panel" aria-labelledby="notifications-title"><h2 id="notifications-title" style="margin-top:0">Notifications for this tab</h2>
<div class="controls"><button id="toasts-toggle" aria-pressed="false">Turn on page toasts</button><button id="system-toggle" aria-pressed="false">Turn on system notifications</button></div>
<p id="notification-status" class="muted"></p>
<p class="muted">Off by default; settings last for this tab session only. Browser permission may be remembered, but alerts must be enabled here for each new session. Keep this page open and connected. Phone sleep or a suspended tab can delay alerts; this is not background push.</p>
</section>
<p id="message" role="status"></p>
<section><h2>Running <span id="running-count" class="badge">0</span></h2><div id="running"></div><p class="muted">Stop requests use the controller’s existing stop behavior. Procedures stop at the next step boundary and attempt their guarded retreat; file/direct jobs send a firmware stop.</p></section>
<section><h2>Ready for approval <span id="ready-count" class="badge">0</span></h2><div id="ready"></div></section>
<section><h2>Approved, waiting to run <span id="approved-count" class="badge">0</span></h2><div id="approved"></div></section>
<section><div class="row"><h2>Recent history</h2><label>Show <select id="filter"><option value="all">All outcomes</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="dismissed">Dismissed / withdrawn</option><option value="stopped">Stopped / cancelled</option><option value="start_failed">Failed</option></select></label></div><div id="history"></div>
<p class="muted">Recent jobs are held in server memory (normally 50 total). Pending and running jobs are retained. Restarting the server clears this history.</p></section>
<div id="toasts" role="status" aria-live="polite"></div>
<script>
(function () {
  'use strict';
  var key='luban.jobs.notifications', prefs={toasts:false,system:false}, registration=null, cursor=null, instance=null, snapshot=null, busy=false;
  var labels={awaiting_confirmation:'Ready for approval',approved:'Approved',starting:'Starting',started:'Running',completed:'Completed',rejected:'Rejected',stopped:'Stopped / cancelled',start_failed:'Failed',submitted:'Ready for approval',failed:'Failed','stop-requested':'Stop requested'};
  var cards=new Map();
  function el(id){return document.getElementById(id);}
  var pendantUrl=new URL('/pendant',window.location.href);pendantUrl.hostname='localhost';el('pendant-link').href=pendantUrl.href;
  try{var saved=JSON.parse(sessionStorage.getItem(key)||'{}');prefs.toasts=saved.toasts===true;prefs.system=saved.system===true;}catch(e){}
  function save(){try{sessionStorage.setItem(key,JSON.stringify(prefs));}catch(e){}}
  function systemAvailable(){return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;}
  function notificationControls(){
    if(!systemAvailable() || Notification.permission!=='granted'){prefs.system=false;save();}
    el('toasts-toggle').textContent=prefs.toasts?'Turn off page toasts':'Turn on page toasts';
    el('toasts-toggle').setAttribute('aria-pressed',String(prefs.toasts));
    el('system-toggle').textContent=prefs.system?'Turn off system notifications':'Turn on system notifications';
    el('system-toggle').setAttribute('aria-pressed',String(prefs.system));
    el('system-toggle').disabled=!systemAvailable();
    el('notification-status').textContent=!window.isSecureContext?'System notifications need trusted HTTPS (localhost also works). On a plain LAN HTTP address, use page toasts.':!systemAvailable()?'System notifications are unavailable in this browser. On iPhone/iPad, use an HTTPS Home Screen web app where supported.':Notification.permission==='denied'?'System notifications are blocked in browser settings. Page toasts remain available.':(prefs.system?'System notifications are on for this tab.':'System notifications are off for this tab.')+' On iPhone/iPad, use a Home Screen web app where supported.';
  }
  function worker(){
    if(registration){return Promise.resolve(registration);}
    return navigator.serviceWorker.register('/jobs/notifications.js',{scope:'/jobs/'}).then(function(reg){
      if(reg.active){registration=reg;return reg;}
      return new Promise(function(resolve,reject){
        var candidate=reg.installing||reg.waiting;
        if(!candidate){reject(new Error('Notification worker unavailable.'));return;}
        var timer=setTimeout(function(){reject(new Error('Notification worker timed out.'));},10000);
        candidate.addEventListener('statechange',function(){if(candidate.state==='activated'){clearTimeout(timer);registration=reg;resolve(reg);}else if(candidate.state==='redundant'){clearTimeout(timer);reject(new Error('Notification worker failed.'));}});
      });
    });
  }
  el('toasts-toggle').onclick=function(){prefs.toasts=!prefs.toasts;save();notificationControls();};
  el('system-toggle').onclick=async function(){
    if(prefs.system){prefs.system=false;save();notificationControls();return;}
    try{
      var permission=await Notification.requestPermission();
      if(permission==='granted'){await worker();prefs.system=true;}
    }catch(e){el('message').textContent='Could not enable notifications: '+e.message;}
    save();notificationControls();
  };
  function toast(text){
    var box=document.createElement('div');box.className='toast';
    var close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss notification');close.onclick=function(){box.remove();};
    box.append(close,document.createTextNode(text));el('toasts').append(box);
    while(el('toasts').children.length>5){el('toasts').firstChild.remove();}
    setTimeout(function(){box.remove();},12000);
  }
  function notify(notice){
    var title=labels[notice.phase]||notice.phase, text=title+': '+notice.name;
    if(prefs.toasts){toast(text);}
    if(prefs.system && systemAvailable() && Notification.permission==='granted'){
      worker().then(function(reg){if(prefs.system){return reg.showNotification('Luban · '+title,{body:notice.name,tag:'luban-job-'+notice.seq,data:{jobId:notice.jobId}});}}).catch(function(e){prefs.system=false;save();notificationControls();el('message').textContent='System notification failed: '+e.message;});
    }
  }
  function node(tag,text,cls){var n=document.createElement(tag);n.textContent=text;if(cls){n.className=cls;}return n;}
  function outcome(job){return job.ending && job.ending.kind==='withdrawn'?'dismissed':job.state;}
  function label(job){return outcome(job)==='dismissed'?'Dismissed / withdrawn':labels[job.state]||job.state;}
  async function action(job,kind,button){
    button.disabled=true;el('message').textContent=kind==='stop'?'Requesting stop…':'Dismissing job…';
    try{
      var r=await fetch('/jobs/'+job.id+'/'+kind,{method:'POST',headers:{'X-Luban-Job-Action':'1'}}), result=await r.json();
      if(!r.ok || result.ok===false){throw new Error(result.error||result.text||'Request failed.');}
      el('message').textContent=result.note||'Request accepted.';
      await poll();
    }catch(e){el('message').textContent=e.message;}finally{button.disabled=false;}
  }
  function makeCard(job){
    var article=node('article','');article.id='job-'+job.id;
    var row=node('div','','row'), title=node('h3',job.name), badge=node('span','','badge');row.append(title,badge);
    var meta=node('p','','muted'), summary=node('p','','summary'), controls=node('div','','controls');
    var review=node('a','Review / approval');review.className='button';review.href='/confirm/'+job.id;review.target='_blank';review.rel='noopener';
    var stop=node('button','Stop job','danger'), dismiss=node('button','Dismiss job');stop.onclick=function(){action(job,'stop',stop);};dismiss.onclick=function(){action(job,'dismiss',dismiss);};
    controls.append(review,stop,dismiss);
    var details=node('details',''), detailTitle=node('summary','Job details and latest events'), pre=node('pre','');details.append(detailTitle,pre);
    details.ontoggle=async function(){if(!details.open){return;}pre.textContent='Loading…';try{var r=await fetch('/jobs/'+job.id+'.json',{cache:'no-store'});var data=await r.json();if(!r.ok){throw new Error(data.error);}pre.textContent=JSON.stringify(data,null,2);}catch(e){pre.textContent=e.message;}};
    article.append(row,meta,summary,controls,details);
    return {article:article,badge:badge,meta:meta,summary:summary,stop:stop,dismiss:dismiss,review:review};
  }
  function render(){
    if(!snapshot){return;}
    var counts={running:0,ready:0,approved:0,history:0}, ids=new Set();
    document.querySelectorAll('.empty').forEach(function(n){n.remove();});
    snapshot.jobs.forEach(function(job){
      var group=job.state==='starting'||job.state==='started'?'running':job.state==='awaiting_confirmation'?'ready':job.state==='approved'?'approved':'history';
      if(group==='history' && el('filter').value!=='all' && outcome(job)!==el('filter').value){return;}
      ids.add(job.id);counts[group]++;
      var card=cards.get(job.id);if(!card){card=makeCard(job);cards.set(job.id,card);}
      card.badge.textContent=label(job);
      card.meta.textContent=job.kind+' · '+job.id+' · '+new Date(job.createdAt).toLocaleString();
      card.summary.textContent=(job.ending?job.ending.reason:job.error||(job.lastEvent && (job.lastEvent.note||job.lastEvent.phase))||'')
        +(job.modalRecovery && job.modalRecovery.recoveryAction?' · G53/G91 may remain ('+(job.modalRecovery.skipReason||job.modalRecovery.status)+'): run '+job.modalRecovery.recoveryAction+' before jogging':'');
      card.stop.hidden=job.id!==snapshot.activeId || group!=='running';
      card.dismiss.hidden=group!=='ready' && group!=='approved';
      card.review.textContent=group==='ready'?'Review / approval':group==='approved'?'View approval':'View plan';
      var position=el(group).children[counts[group]-1];
      if(position!==card.article){el(group).insertBefore(card.article,position||null);}
    });
    cards.forEach(function(card,id){if(!ids.has(id)){card.article.remove();cards.delete(id);}});
    Object.keys(counts).forEach(function(group){if(el(group+'-count')){el(group+'-count').textContent=counts[group];}if(!counts[group]){el(group).append(node('p',group==='running'?'No running jobs.':group==='history'?'No matching recent jobs.':'No jobs waiting here.','empty'));}});
  }
  async function poll(){
    if(busy){return;}busy=true;
    var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},10000);
    try{
      var query=cursor===null?'':'?since='+cursor+'&instance='+encodeURIComponent(instance);
      var r=await fetch('/jobs/status.json'+query,{cache:'no-store',signal:controller.signal});
      if(!r.ok){throw new Error('HTTP '+r.status);}
      snapshot=await r.json();cursor=snapshot.cursor;instance=snapshot.instance;
      el('connection').textContent='Connected · updated '+new Date().toLocaleTimeString();el('connection').className='muted';
      if(snapshot.missed){el('message').textContent='Some notifications expired while disconnected. Review recent history.';}
      render();snapshot.notices.forEach(notify);
    }catch(e){el('connection').textContent='Disconnected · displayed jobs may be stale. Retrying…';el('connection').className='error';cards.forEach(function(card){card.stop.disabled=true;card.dismiss.disabled=true;});}
    finally{clearTimeout(timer);busy=false;}
  }
  el('filter').onchange=render;
  notificationControls();poll();setInterval(function(){poll().then(function(){if(el('connection').className!=='error'){cards.forEach(function(card){card.stop.disabled=false;card.dismiss.disabled=false;});}});},2000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){notificationControls();poll();}});
})();
</script></body></html>`;

// No push subscription, background polling, cached pages, or server-side client settings.
export const notificationWorker = `
self.addEventListener('install',function(event){event.waitUntil(self.skipWaiting());});
self.addEventListener('notificationclick',function(event){
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clients){
    var existing=clients.find(function(client){return /^\\/jobs\\/?$/.test(new URL(client.url).pathname);});
    return existing?existing.focus():self.clients.openWindow('/jobs/');
  }));
});
`;
