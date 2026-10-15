import assert from 'assert';
import vm from 'vm';
import { pendantPage } from '../pendantPage';

// Exercise the actual page script with inert HTTP and DOM surfaces; never contact a machine.
async function pageFixture() {
    const elements = new Map<string, Element>();
    class Element {
        public id = '';

        public value: string | number = '';

        public textContent = '';

        public innerHTML = '';

        public className = '';

        public step = '';

        public checked = false;

        public disabled = false;

        public focused = false;

        public scrolled = false;

        public focus() { this.focused = true; }

        public scrollIntoView() { this.scrolled = true; }

        public onclick: (() => void | Promise<void>) | null = null;

        public onsubmit: ((event: { preventDefault: () => void }) => Promise<void>) | null = null;

        public onchange: (() => void) | null = null;

        public oninput: (() => void) | null = null;

        public appendChild(child: Element) { if (child.id) { elements.set(child.id, child); } }

        public setAttribute() { /* Accessibility attributes do not affect these interactions. */ }

        public addEventListener() { /* Native form validation is not simulated here. */ }
    }
    const html = pendantPage('test-token');
    for (const match of html.matchAll(/id="([^"]+)"/g)) { elements.set(match[1], new Element()); }
    const element = (id: string): Element => {
        const found = elements.get(id);
        if (!found) { throw Error(`Missing page element ${id}`); }
        return found;
    };
    const state = { armed: false,
        neutral: false,
        busy: false,
        error: '',
        blocked: null as null | { name: string; requiredZ: number | null; requestedZ: number; held: boolean; text: string },
        bounds: null as null | object,
        ports: [{ path: 'COM42' }],
        input: { mode: 'feed' },
        dro: { machine: { x: 10, y: 20, z: 30 }, work: { x: 1, y: 2, z: 3 }, reliability: 'verified', warnings: [] as string[] },
        settings: { activeTool: { active: null, stored: null }, toolProtrusion: { mm: 70, source: 'longest-bit' }, clearanceMarginMm: 5, landmarks: [{ id: 'rotary-id', name: 'rotary', description: 'Rotary unit', machine: { x0: 140, x1: 200, y0: 0, y1: 350 }, clearanceZ: 250, clearanceBasis: 'physical', notes: '' }] },
        obstacleExclusions: [{ name: 'rotary-axis', machine: { x0: 135, x1: 205, y0: -5, y1: 355 }, requiredZ: 328 as number | null }],
        travelBounds: { xMin: -19, xMax: 330, yMin: 0, yMax: 342, zMin: 0, zMax: 328 },
        defaultBounds: { xMin: 119, xMax: 129, yMin: 198.328994873, yMax: 208.328994873, zMin: 280, zMax: 329 } };
    let refuse = false;
    const bodyClasses = new Set<string>();
    const posted: Array<{ url: string; body: { bounds?: object } }> = [];
    const intervals: Array<() => undefined> = [];
    let stallStatus = false;
    let clock = 1000;
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    assert.ok(script);
    vm.runInNewContext(script as string, {
        document: { hidden: false,
            body: { classList: { toggle: (name: string, enabled: boolean) => { if (enabled) { bodyClasses.add(name); } else { bodyClasses.delete(name); } } } },
            getElementById: element,
            createElement: () => new Element(),
            addEventListener: () => undefined },
        setInterval: (callback: () => undefined) => { intervals.push(callback); },
        AbortController: class { public signal = {}; public abort() { return undefined; } },
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        Date: { now: () => clock },
        fetch: async (url: string, options?: { body: string }) => {
            if (!options) { return stallStatus ? new Promise(() => undefined) : { ok: true, json: async () => state }; }
            posted.push({ url, body: JSON.parse(options.body) });
            if (url.endsWith('/arm')) {
                if (refuse) { return { ok: false, json: async () => ({ error: 'arm refused: rotary clearance' }) }; }
                state.armed = true;
            }
            if (url.endsWith('/disarm')) { state.armed = false; }
            return { ok: true, json: async () => ({ ok: true }) };
        }
    });
    const settle = async () => new Promise<void>((resolve) => setImmediate(resolve));
    await settle();
    return { element,
        bodyClasses,
        posted,
        state,
        refuse: () => { refuse = true; },
        refresh: async () => { intervals[0](); await settle(); },
        keepalive: async () => { intervals[1](); await settle(); },
        stallStatus: () => { stallStatus = true; },
        advance: (ms: number) => { clock += ms; },
        arm: async () => { await element('envelope').onsubmit?.({ preventDefault: () => undefined }); } };
}

export const tests: Array<[string, () => Promise<void>]> = [
    ['plan map draws obstacles and warns beside Arm only when the envelope reaches below their required Z', async () => {
        const f = await pageFixture();
        f.state.settings.landmarks[0].name = 'rotary-axis';
        f.state.obstacleExclusions.push({ name: 'tool-setter <b>', machine: { x0: 33, x1: 94, y0: 264, y1: 308 }, requiredZ: 328 });
        f.state.settings.landmarks.push({ id: 'ts', name: 'tool-setter <b>', description: 'Setter', machine: { x0: 38, x1: 89, y0: 269, y1: 303 }, clearanceZ: 328, clearanceBasis: undefined as unknown as string, notes: 'legacy' });
        await f.refresh();
        const map = () => f.element('map').innerHTML;
        assert.match(map(), /^<svg /);
        assert.match(map(), /data-name="rotary-axis"/);
        assert.match(map(), /needs Z ≥ 328/);
        assert.match(map(), /tool-setter &lt;b&gt;/);
        assert.ok(!map().includes('<b>'), 'obstacle names are escaped');
        assert.match(map(), /id="toolhead-live"/);
        assert.ok(!map().includes('obstacle danger'), 'the default ±5 mm envelope stays clear of both boxes');
        assert.equal(f.element('obstacle-warning').textContent, '');
        await f.element('fill-xy').onclick?.();
        assert.match(map(), /class="obstacle danger" data-name="rotary-axis"/);
        const warning = f.element('obstacle-warning').textContent;
        assert.match(warning, /Your envelope Z 280–328 overlaps rotary-axis: inside X135–205, Y-5–355 \(incl. 5 mm margin\) the toolhead cannot go below Z328/);
        assert.match(warning, /overlaps tool-setter <b>: inside X33–94/);
        assert.match(f.element('obstacle-table').innerHTML, /OVERLAPS below required Z/);
        assert.match(f.element('obstacle-table').innerHTML, /toolhead Z, legacy default/);
        assert.match(f.element('obstacle-table').innerHTML, /250 \(physical top\)/);
        f.state.travelBounds.zMax = 330; await f.refresh();
        f.element('zMin').value = 328; f.element('zMin').oninput?.();
        assert.match(map(), /envelope Z 328–329/);
        assert.equal(f.element('obstacle-warning').textContent, '');
        assert.ok(!map().includes('obstacle danger'));
        f.state.obstacleExclusions[0].requiredZ = null; await f.refresh();
        assert.match(f.element('obstacle-warning').textContent, /rotary-axis: tool clearance is unknown/);
        assert.match(map(), /no entry: tool unknown/);
        f.state.busy = true; await f.refresh();
        assert.match(map(), /id="toolhead-held"/);
        assert.ok(!map().includes('toolhead-live'));
    }],
    ['the map and warning never understate a required Z, and INSIDE explains the Z-up exit', async () => {
        const f = await pageFixture();
        f.state.obstacleExclusions[0].requiredZ = 327.951;
        await f.element('fill-xy').onclick?.();
        assert.match(f.element('map').innerHTML, /needs Z ≥ 327.96/);
        assert.match(f.element('obstacle-warning').textContent, /cannot go below Z327.96;/);
        f.state.armed = true;
        f.state.bounds = { xMin: 100, xMax: 180, yMin: 0, yMax: 342, zMin: 280, zMax: 328 };
        f.state.blocked = { name: 'rotary-axis', requiredZ: 327.951, requestedZ: 300, held: true, inside: true, text: 'INSIDE rotary-axis below Z327.96: Z-up only' } as never;
        await f.refresh();
        assert.match(f.element('blocked').textContent, /^INSIDE rotary-axis below Z327.96: Z-up only — the toolhead is inside this exclusion. Only a straight Z-up exit is sent/);
        assert.equal(f.element('blocked').className, 'held');
    }],
    ['armed map uses the armed envelope and mirrors a held obstacle refusal beside it', async () => {
        const f = await pageFixture();
        f.state.armed = true;
        f.state.bounds = { xMin: 100, xMax: 180, yMin: 0, yMax: 342, zMin: 280, zMax: 328 };
        f.state.blocked = { name: 'rotary-axis', requiredZ: 328, requestedZ: 327.911, held: true, text: 'BLOCKED rotary-axis: Z>=328 (asked 327.9)' };
        await f.refresh();
        assert.match(f.element('map').innerHTML, /armed Z 280–328/);
        assert.match(f.element('obstacle-warning').textContent, /overlaps rotary-axis/);
        assert.match(f.element('blocked').textContent, /^BLOCKED rotary-axis: Z>=328 \(asked 327.9\) — nothing sent, still armed/);
        assert.equal(f.element('blocked').className, 'held');
        assert.match(f.element('state').textContent, /^ARMED.*BLOCKED rotary-axis/);
        f.state.blocked = null; await f.refresh();
        assert.equal(f.element('blocked').textContent, '');
        assert.ok(!f.element('state').textContent.includes('BLOCKED'));
    }],
    ['keepalive has its own timer but stops once status has not rendered for 1.5 s', async () => {
        const f = await pageFixture();
        const keepalives = () => f.posted.filter((p) => p.url.endsWith('/keepalive')).length;
        await f.keepalive();
        assert.equal(keepalives(), 0);
        f.element('clear').checked = true;
        await f.arm();
        f.stallStatus();
        await f.refresh();
        for (let i = 0; i < 3; i += 1) { await f.keepalive(); }
        assert.equal(keepalives(), 3);
        f.advance(1600);
        await f.keepalive();
        assert.equal(keepalives(), 3);
    }],
    ['DRO retains labelled values through in-flight motion and refreshes on verified arrival', async () => {
        const f = await pageFixture();
        assert.match(f.element('dro').textContent, /MACHINE: X 10.000/);
        f.state.busy = true; f.state.dro.machine.x = 999; await f.refresh();
        assert.match(f.element('dro').textContent, /Held values/);
        assert.match(f.element('dro').textContent, /MACHINE: X 10.000/);
        f.state.busy = false; f.state.dro.machine.x = 15; await f.refresh();
        assert.match(f.element('dro').textContent, /MACHINE: X 15.000/);
        assert.ok(!f.element('dro').textContent.includes('Held values'));
    }],
    ['USB choices recover after hotplug and preserve the selected device', async () => {
        const f = await pageFixture();
        assert.equal(f.element('port').value, 'COM42');
        f.state.ports = []; await f.refresh();
        assert.equal(f.element('connect').disabled, true);
        await f.element('connect').onclick?.(); assert.equal(f.posted.length, 0);
        f.state.ports = [{ path: 'COM43' }, { path: 'COM44' }]; await f.refresh();
        assert.equal(f.element('port').value, 'COM43');
        f.element('port').value = 'COM44'; await f.refresh();
        assert.equal(f.element('port').value, 'COM44');
        assert.equal(f.element('connect').disabled, false);
    }],
    ['Home requires an operator click and explicitly permits stale recovery including rotary homing', async () => {
        const f = await pageFixture();
        assert.equal(f.posted.length, 0);
        await f.element('home').onclick?.();
        assert.deepEqual(f.posted, [{ url: '/pendant/home', body: { confirmHoming: true } }]);
        assert.match(f.element('action').textContent, /Homing completed and verified/);
    }],

    ['machine-fill buttons are independent, invalidate consent and preview travel clipping', async () => {
        const f = await pageFixture();
        assert.equal(f.element('yMin').step, 'any');
        assert.equal(f.element('yMin').value, 198.329);
        assert.equal(f.element('zMin').value, 280);
        assert.equal(f.element('zMax').value, 329);
        f.element('clear').checked = true;
        await f.element('fill-x').onclick?.();
        assert.equal(f.element('xMin').value, -20);
        assert.equal(f.element('xMax').value, 331);
        assert.equal(f.element('yMin').value, 198.329);
        assert.equal(f.element('clear').checked, false);
        await f.element('fill-y').onclick?.();
        assert.equal(f.element('yMin').value, -1);
        assert.equal(f.element('yMax').value, 343);
        await f.element('fill-xy').onclick?.();
        assert.match(f.element('effective').textContent, /X -20.000 to 331.000/);
        assert.match(f.element('effective').textContent, /Z 280.000 to 329.000/);
        assert.match(f.element('exclusions').textContent, /rotary-axis: X 135 to 205.*requires Z ≥ 328.000/);
        assert.ok(f.element('exclusions').textContent.includes('\n'));
        f.element('clear').checked = true;
        await f.arm();
        assert.ok(f.posted.some((request) => request.url === '/pendant/arm'));
        assert.equal(f.state.armed, true);
        assert.equal(f.element('review').disabled, true);
    }],
    ['Z mode changes page background and warning even while disarmed; feed restores normal', async () => {
        const f = await pageFixture();
        assert.equal(f.bodyClasses.has('z-mode'), false);
        f.state.input.mode = 'z'; await f.refresh();
        assert.equal(f.bodyClasses.has('z-mode'), true);
        assert.match(f.element('mode-banner').textContent, /DANGER: TWIST CONTROLS Z/);
        f.state.input.mode = 'feed'; await f.refresh();
        assert.equal(f.bodyClasses.has('z-mode'), false);
        assert.match(f.element('mode-banner').textContent, /FEED ADJUST/);
    }],
    ['operator can inspect and submit fitted-tool and obstruction edits without automatic saves', async () => {
        const f = await pageFixture();
        assert.match(f.element('tool-summary').textContent, /70 mm/);
        f.element('obstacle-select').value = 'rotary-id'; f.element('obstacle-select').onchange?.();
        assert.equal(f.element('obstacle-height').value, 250);
        assert.match(f.element('obstacle-preview').textContent, /325.000/);
        f.element('obstacle-height').value = 240;
        await f.refresh();
        assert.equal(f.element('obstacle-height').value, 240);
        assert.equal(f.posted.length, 0);
        await f.element('obstacle-form').onsubmit?.({ preventDefault: () => undefined });
        assert.equal(f.posted[0].url, '/pendant/settings');
        assert.deepEqual(f.posted[0].body, { kind: 'obstacle',
            id: 'rotary-id',
            name: 'rotary',
            description: 'Rotary unit',
            enabled: true,
            clearanceBasis: 'physical',
            clearanceZ: 240,
            notes: '',
            x0: 140,
            x1: 200,
            y0: 0,
            y1: 350 });
        assert.match(f.element('settings-feedback').textContent, /Saved/);
        f.element('tool-length').value = 12;
        await f.element('tool-form').onsubmit?.({ preventDefault: () => undefined });
        assert.equal((f.posted.slice(-1)[0].body as { protrusionMm?: number }).protrusionMm, 12);
    }],
    ['polled jog refusals are revealed beside the controls without opening diagnostics', async () => {
        const f = await pageFixture();
        f.state.error = 'Jog blocked by rotary-axis: requires machine Z at or above 328.000 mm.';
        await f.refresh();
        assert.match(f.element('action').textContent, /requires machine Z at or above 328.000/);
        assert.equal(f.element('action').focused, true);
        assert.equal(f.element('action').scrolled, true);
        f.element('action').scrolled = false;
        await f.refresh();
        assert.equal(f.element('action').scrolled, false);
    }],
    ['refused arm stays visible through polls and Stop has explicit persistent acknowledgement', async () => {
        const f = await pageFixture();
        f.refuse(); await f.arm();
        await f.refresh(); await f.refresh();
        assert.match(f.element('action').textContent, /rotary clearance/);
        assert.equal(f.element('action').focused, true);
        assert.equal(f.element('action').scrolled, true);
        await f.element('stop').onclick?.();
        await f.refresh();
        assert.match(f.element('action').textContent, /Stop accepted. Disarmed/);
        assert.match(f.element('state').textContent, /DISARMED/);
        assert.equal(f.state.armed, false);
    }],
];
