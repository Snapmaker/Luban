# Luban Wi-Fi Reliability Fixes (HTTP path) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the operative HTTP-path reliability bugs on the user's Snapmaker A350 (firmware V1.21.0, Wi-Fi = HTTP/AndServer) — UI freeze, stuck "homing", laser on/off desync, and the "go to work origin drives into the bed" cluster — verified live where safe.

**Architecture:** Server-side `ConnectionManager` + `SstpHttpChannel` (the HTTP channel) and the renderer `flux/workspace` reducer. Where logic is testable, extract a pure helper and cover it with a `tape` test (`test/*.js`, run via `npm test`). Connection-plumbing and motion changes that can't be unit-tested get a careful edit plus a **manual live-validation script** the user runs at the machine (hand near e-stop).

**Tech stack:** TypeScript server (built via gulp/babel), `tape` tests under `test/`, `superagent` HTTP, Electron renderer (redux-ish `flux`).

**Branch:** `audit/wifi-reliability` (already off `chore/update-webpack-4-to-5`).

**Source of truth:** `docs/superpowers/audits/2026-06-13-wifi-connection-audit.md` (see §6 for the operative-vs-non-operative split; this plan implements the operative HTTP set only). SACP fixes (R1/R2/R3) are deferred — notes in `docs/superpowers/audits/SACP-protocol-reference.md`.

---

## Safety protocol (applies to every task)

- **No agent-driven motion, no laser power, no heater, no origin writes, no job starts.** The agent may run `npm test`, `npm run eslint`, and the build only.
- Motion-related fixes (Tasks 7–9) are validated ONLY by (a) unit tests on extracted logic and (b) a **manual live-validation script** executed by the user with a hand on the e-stop. The agent must NOT connect-and-move.
- After each task: `npm run eslint` must pass (0 errors), and `npx tsc --noEmit -p tsconfig-server.json` must pass for server-side edits.

## Confirmed machine facts (from live capture)

- `/api/v1/status` body has **no `headStatus`** (laser on/off), only numeric `laserPower`; `homed` is a correct boolean; fields include `laserFocalLength`, `laser10WErrorState`, `laserCamera`, `toolHead`, `isEnclosureDoorOpen`, coarse `moduleList` presence booleans.
- Protocol over Wi-Fi = HTTP (`this.protocol === NetworkProtocol.HTTP`, i.e. the `else` branch in `ConnectionManager` motion methods).

---

## Task order & fix mapping

Plumbing/state first (Tasks 1–6), then motion-safety (Tasks 7–9, need manual validation). Mapping to audit IDs: T1=R4(01-F12/03-F6), T2=R9(01-F2), T3=R20(01-F7), T4=R5-HTTP(02-F5), T5=04-F9, T6=R13(02-F11), T7=R6(02-F2), T8=R7(02-F3), T9=R10(02-F4).

---

### Task 1: R4 — Stop killing the active HTTP poller on every new client socket

**Why:** `connectionManager.onConnection` fires per socket.io connection and calls `sstpHttpChannel.onConnection()` → `stopHeartBeat()`, freezing the UI on a 2nd window or a transparent reconnect (audit 01-F12 / 03-F6, P0).

**Files:**
- Modify: `src/server/services/machine/channels/SstpHttpChannel.ts` (`onConnection`, ~line 147)
- Read first: `ConnectionManager.onConnection` (~line 133), `connectionOpen` (the only place that legitimately (re)starts the poller).

- [ ] **Step 1: Read current bodies** with Serena: `SstpHttpChannel/onConnection`, `SstpHttpChannel/connectionOpen` (find where `startHeartBeat`/heartbeat worker is launched), `ConnectionManager/onConnection`.
- [ ] **Step 2: Make `onConnection` a no-op for the heartbeat** (do not stop the poller of an already-connected machine). Replace the body so it no longer calls `this.stopHeartBeat()`. If `stopHeartBeat` exists to clear a *stale* worker before a fresh `connectionOpen`, move that call into `connectionOpen` instead (stop-then-start there), so the poller is only cycled when a client actually (re)opens a connection.

```ts
public onConnection = () => {
    // Previously: this.stopHeartBeat();  // killed the live machine's poller on ANY new client socket.
    // The poller lifecycle is owned by connectionOpen/connectionClose; a new client socket must not stop it.
};
```

In `connectionOpen`, ensure the poller is cleanly restarted (stop if running, then start) so re-open still works:
```ts
// inside connectionOpen, just before starting the heartbeat worker:
this.stopHeartBeat();
// ...then start as today
```

- [ ] **Step 3: Verify build + lint.** Run `npx tsc --noEmit -p tsconfig-server.json` (expect exit 0) and `npm run eslint` (expect 0 errors).
- [ ] **Step 4: Commit.**
```bash
git add src/server/services/machine/channels/SstpHttpChannel.ts
git commit -m "Fix: Don't kill HTTP status poller on every new client socket (R4/01-F12)"
```
- [ ] **Step 5: Manual validation script (user, safe — no motion):**
  1. Connect Luban to the machine over Wi-Fi; confirm position/status updates live.
  2. Open a second Luban window (or reload the renderer).
  3. **Expected:** the first window keeps updating position/workflow status (previously it froze). No motion involved.

---

### Task 2: R9 — Report laser on/off correctly (derive from laserPower; stop coercing)

**Why:** HTTP never sends `headStatus`; renderer does `compareAndSet(data, currentState, 'headStatus', !!headStatus)` unconditionally → laser toggle forced `false` every poll (audit 01-F2, P0). Confirmed live (no `headStatus` field).

**Files:**
- Create: `src/server/services/machine/channels/laserState.ts` (pure helper)
- Create: `test/laserState.js` (tape test)
- Modify: `src/app/flux/workspace/index.ts` (the `Marlin:state` handler, ~line 485)
- Modify: `src/server/services/machine/channels/SstpHttpChannel.ts` (status mapping — add derived `headStatus`)

- [ ] **Step 1: Write the failing test** `test/laserState.js`:
```js
import { test } from 'tape';
import { deriveHeadStatus } from '../src/server/services/machine/channels/laserState';

test('deriveHeadStatus', (t) => {
    t.equal(deriveHeadStatus(0), false, 'zero power => off');
    t.equal(deriveHeadStatus(5), true, 'positive power => on');
    t.equal(deriveHeadStatus(undefined), undefined, 'unknown power => undefined (do not assert)');
    t.equal(deriveHeadStatus(null), undefined, 'null power => undefined');
    t.end();
});
```
- [ ] **Step 2: Run it, expect failure** (`module not found`): `npm test 2>&1 | grep -i laserState`.
- [ ] **Step 3: Implement the helper** `src/server/services/machine/channels/laserState.ts`:
```ts
// Returns true/false when laser power is known, undefined when unknown (so callers can skip the update).
export function deriveHeadStatus(laserPower: number | undefined | null): boolean | undefined {
    if (laserPower === undefined || laserPower === null) return undefined;
    return laserPower > 0;
}
```
- [ ] **Step 4: Run test, expect pass:** `npm test 2>&1 | grep -i laserState`.
- [ ] **Step 5: Emit derived headStatus on the HTTP status path.** In `SstpHttpChannel` where `/api/v1/status` is mapped into the `Marlin:state` payload (the heartBeat `online` handler / status mapping), set `headStatus: deriveHeadStatus(data.laserPower)` so the server supplies it. Import the helper.
- [ ] **Step 6: Fix the renderer coercion.** In `src/app/flux/workspace/index.ts` `Marlin:state` handler, change the unconditional `compareAndSet(data, currentState, 'headStatus', !!headStatus)` to only write when defined (matching neighbouring `!isNil` fields):
```ts
if (!isNil(headStatus)) {
    compareAndSet(data, currentState, 'headStatus', headStatus);
}
```
(Confirm `isNil` is already imported in this file; it is used by neighbouring fields.)
- [ ] **Step 7: Build + lint:** `npx tsc --noEmit -p tsconfig-server.json` and `npm run eslint`.
- [ ] **Step 8: Commit.**
```bash
git add src/server/services/machine/channels/laserState.ts test/laserState.js src/server/services/machine/channels/SstpHttpChannel.ts src/app/flux/workspace/index.ts
git commit -m "Fix: Report laser on/off from laserPower; stop coercing headStatus to false (R9/01-F2)"
```
- [ ] **Step 9: Manual validation (user, safe):** Connect; on the machine touchscreen start/stop the laser crosshair or a low-power test (user's discretion, their safety) — Luban's laser toggle/state should now follow `laserPower`. (Optional; no agent motion.)

---

### Task 3: R20 — HTTP poll failures shouldn't wipe good state; signal staleness

**Why:** A failed enclosure poll caches `undefined` and overwrites good redux enclosure values; status-poll failures emit nothing/no staleness signal (audit 01-F7, P1).

**Files:**
- Modify: `src/server/services/machine/channels/SstpHttpChannel.ts` (`getEnclosureStatus`, ~lines 856–874; module/enclosure poll error branches ~571–597)

- [ ] **Step 1: Read** `SstpHttpChannel/getEnclosureStatus` and the `getModuleInfo`/`getModuleList` error branches with Serena.
- [ ] **Step 2: Guard `getEnclosureStatus`** against error/empty data before caching/emitting:
```ts
const result = _getResult(err, res);
const data = result?.data;
if (err || !data) {
    return; // do not cache undefined, do not emit a settings object that overwrites good values
}
if (!isEqual(this.moduleSettings, data)) {
    this.moduleSettings = data;
    this.socket && this.socket.emit('Marlin:settings', { /* fields from data */ });
}
```
- [ ] **Step 3: Same guard** for the `getModuleInfo`/`getModuleList` `if (!err)` blocks: on error, do not emit. (No `else` that emits undefined.)
- [ ] **Step 4: Build + lint**, then **Step 5: Commit** `Fix: Guard HTTP poll error paths from wiping good redux state (R20/01-F7)`.
- [ ] **Step 6: Manual validation (user, safe):** Connect; briefly drop Wi-Fi (toggle laptop Wi-Fi) and restore. Enclosure light/fan/door values in the UI should NOT blank out to undefined during the blip.

---

### Task 4: R5-HTTP — Fix homing-state reporting so the modal closes (stop "slow homing")

**Why:** On HTTP, `goHome` emits `move:status {isHoming:true}` *after* `G28` completes and **never emits `false`**, so the homing modal sticks and homing looks slow/stuck (audit 02-F5, P1). This is the most likely cause of the user's "slow homing."

**Files:**
- Modify: `src/server/services/machine/ConnectionManager.ts` (`goHome`, lines 1291–1310)

- [ ] **Step 1: Reorder/repair the HTTP branch of `goHome`.** Emit `isHoming:true` *before* `G28`, and `isHoming:false` after it completes; keep the G54 restore. Current HTTP branch:
```ts
} else {
    await this.executeGcode(socket, { gcode: 'G53' });
    await this.executeGcode(socket, { gcode: 'G28' });
    callback && callback();
    if (this.connectionType === ConnectionType.WiFi) {
        socket && socket.emit('move:status', { isHoming: true });
    }
    if (headType === HEAD_LASER || headType === HEAD_CNC) {
        await this.executeGcode(socket, { gcode: 'G54' });
    }
}
```
Replace with:
```ts
} else {
    if (this.connectionType === ConnectionType.WiFi) {
        socket && socket.emit('move:status', { isHoming: true });
    }
    await this.executeGcode(socket, { gcode: 'G53' });
    await this.executeGcode(socket, { gcode: 'G28' });
    // G28 (per firmware) returns after homing completes; homing is now done.
    if (headType === HEAD_LASER || headType === HEAD_CNC) {
        await this.executeGcode(socket, { gcode: 'G54' });
    }
    if (this.connectionType === ConnectionType.WiFi) {
        socket && socket.emit('move:status', { isHoming: false });
    }
    callback && callback();
}
```
> Note: this depends on `/api/v1/execute_code` for `G28` blocking until homing completes. The audit flags this as open question; the HTTP queue (`_executeGcode`) awaits the screen's response. If field testing shows `isHoming:false` fires too early, gate it on the next status poll reporting `homed:true` instead. Document whichever is used.
- [ ] **Step 2: Restore G54 for all head types, not just laser/CNC** (avoids leaving machine in machine-space for an undefined headType — ties to Task 8). Change the `if (headType === HEAD_LASER || headType === HEAD_CNC)` guard to always restore `G54` after homing (a printing head re-selecting G54 is harmless). Confirm with the user if unsure; default to always-restore.
- [ ] **Step 3: Build + lint**, **Step 4: Commit** `Fix: Emit homing start/finish in correct order on HTTP; always restore G54 (R5/02-F5)`.
- [ ] **Step 5: Manual validation (user, AT MACHINE, hand on e-stop — this DOES move):**
  1. With workspace clear and Z safe, press Home in Luban.
  2. **Expected:** homing modal appears immediately, closes when homing finishes (no lingering "homing…"), motion buttons re-enable. Homing should no longer *appear* stuck.

---

### Task 5: 04-F9 — HTTP `executeGcode` must report real success/failure

**Why:** `consumeGCodeQueue` always calls back with `result:0`; `_executeGcode` resolves `{code}` on error. So a failed preparatory `G0 Z<focal+thickness>` before a laser job is invisible and the job starts at the wrong Z (audit 04-F9, P1 — origin-crash contributor).

**Files:**
- Modify: `src/server/services/machine/channels/SstpHttpChannel.ts` (`_executeGcode` ~387–404, `consumeGCodeQueue` ~406–430, `executeGcode` ~435–458)
- Modify: `src/server/services/machine/ConnectionManager.ts` (`startGcode` HTTP preamble ~700–754 — abort on failed prep move)

- [ ] **Step 1: Read** the three `SstpHttpChannel` methods + `ConnectionManager/startGcode` with Serena.
- [ ] **Step 2: Propagate real result.** Make `_executeGcode` surface the HTTP error (reject or resolve `{ok:false, code}`); in `consumeGCodeQueue` track the worst per-line result and pass it to the queue item callback instead of the hard-coded `result:0`. Make `executeGcode`'s callback honor a non-zero/`ok:false` result (so the `result:-1` branch is no longer dead).
- [ ] **Step 3: Abort job on failed prep.** In `startGcode`'s HTTP path, change `Promise.all(promises).then(() => { uploadGcodeFile…; startGcode… })` to inspect results and **abort + emit an error event** (`SocketEvent.StartGCode {err}`) if any preparatory move failed; add a `.catch`.
- [ ] **Step 4: Build + lint**, **Step 5: Commit** `Fix: Surface HTTP executeGcode failures; abort job start on failed prep move (04-F9)`.
- [ ] **Step 6: Manual validation (user, AT MACHINE):** Hard to trigger safely; rely on code review + the unit-testable parts. Optionally: with the toolhead detached (so a move errors), start a laser job and confirm Luban reports an error instead of silently proceeding. *User discretion.*

---

### Task 6: R13 — `setWorkOrigin` must not drop zero-valued axes

**Why:** Truthiness gating (`xPosition && …`) skips an axis whose value is exactly `0`, leaving a stale per-axis origin; the AB-position/camera flows pass machine positions that can be 0 (audit 02-F11, P1).

**Files:**
- Create: `src/server/services/machine/setWorkOriginGcode.ts` (pure helper)
- Create: `test/setWorkOriginGcode.js`
- Modify: `src/server/services/machine/ConnectionManager.ts` (`setWorkOrigin` HTTP branch ~1334–1338)

- [ ] **Step 1: Write failing test** `test/setWorkOriginGcode.js`:
```js
import { test } from 'tape';
import { buildSetWorkOriginGcode } from '../src/server/services/machine/setWorkOriginGcode';

test('buildSetWorkOriginGcode includes zero-valued axes', (t) => {
    t.equal(buildSetWorkOriginGcode({ x: 0, y: 0, z: 0 }), 'G92 X0 Y0 Z0', 'all zeros included');
    t.equal(buildSetWorkOriginGcode({ x: 10, z: 0 }), 'G92 X10 Z0', 'zero Z included with nonzero X');
    t.equal(buildSetWorkOriginGcode({ b: 0 }), 'G92 B0', 'zero B axis included');
    t.equal(buildSetWorkOriginGcode({}), 'G92', 'no axes => bare G92');
    t.end();
});
```
- [ ] **Step 2: Run, expect fail.** `npm test 2>&1 | grep -i setWorkOrigin`.
- [ ] **Step 3: Implement helper:**
```ts
type Axes = { x?: number; y?: number; z?: number; b?: number };
export function buildSetWorkOriginGcode(axes: Axes): string {
    const parts: string[] = [];
    (['x', 'y', 'z', 'b'] as const).forEach((k) => {
        const v = axes[k];
        if (Number.isFinite(v)) parts.push(`${k.toUpperCase()}${v}`);
    });
    return ['G92', ...parts].join(' ');
}
```
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Use it** in `ConnectionManager.setWorkOrigin` HTTP branch (replace the truthiness-built gcode). For the SACP branch (deferred), leave a `// TODO(R13/SACP)` note referencing the same `Number.isFinite` fix.
- [ ] **Step 6: Build + lint**, **Step 7: Commit** `Fix: Include zero-valued axes when setting work origin (R13/02-F11)`.

---

### Task 7: R6 — "Go to work origin": lift/sequence Z, never descend diagonally

**Why:** All axes are packed into one `G0 X0 Y0 B0 Z0` line → simultaneous diagonal descent; the per-axis ordering in the UI is dead code; no Z-lift guard (audit 02-F2, P0, origin-crash).

**Files:**
- Create: `src/server/services/machine/moveSequencing.ts` (pure helper) + `test/moveSequencing.js`
- Modify: `src/app/ui/widgets/ConnectionControl/Control.tsx` (`move`, ~231–254) and/or `MotionButtonGroup.jsx` (~65–74) so "Go To Work Origin" emits **two sequenced moves**.

- [ ] **Step 1: Write failing test** `test/moveSequencing.js`:
```js
import { test } from 'tape';
import { sequenceGoToOrigin } from '../src/server/services/machine/moveSequencing';

test('sequenceGoToOrigin lifts Z first when descending', (t) => {
    // current Z above target (z=0): move XY first, then descend Z
    t.deepEqual(sequenceGoToOrigin({ z: 5 }, 1500),
        ['G0 X0 Y0 B0 F1500', 'G0 Z0 F1500'], 'descend: XY then Z');
    // current Z below/at target: raise Z first, then XY
    t.deepEqual(sequenceGoToOrigin({ z: -2 }, 1500),
        ['G0 Z0 F1500', 'G0 X0 Y0 B0 F1500'], 'ascend: Z then XY');
    t.end();
});
```
> Rationale: when the head is ABOVE the work origin, move XY at the safe height first, then lower Z last (so we never traverse low). When BELOW, raise Z to origin first. This avoids diagonal descent into the bed.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement helper:**
```ts
export function sequenceGoToOrigin(current: { z: number }, feed: number): string[] {
    const xy = `G0 X0 Y0 B0 F${feed}`;
    const z = `G0 Z0 F${feed}`;
    return current.z > 0 ? [xy, z] : [z, xy];
}
```
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Wire into the UI "Go To Work Origin" path.** Replace the single-`G0` emit with the two sequenced commands (send the first, await, then the second). Keep the existing jog path unchanged. Remove the dead per-axis object-ordering in `MotionButtonGroup.jsx`.
- [ ] **Step 6: Build + lint**, **Step 7: Commit** `Fix: Sequence Z separately on Go-To-Work-Origin to avoid diagonal bed descent (R6/02-F2)`.
- [ ] **Step 8: Manual validation (user, AT MACHINE, hand on e-stop — DOES move):**
  1. Home, set a work origin at the material surface, jog up +20mm in Z and +X/+Y.
  2. Press "Go To Work Origin".
  3. **Expected:** head moves in XY at the raised height first, THEN lowers Z straight down to origin — no diagonal plunge. Then repeat with head BELOW origin Z (e.g. origin set high): Z should raise first.

---

### Task 8: R7 — Never leave the machine in modal G53 (machine-space leak)

**Why:** Bare `G53;` from camera-aid capture (no `.catch`) and the headType-gated G54 restore in `goHome` can leave the next absolute move in machine space → plunge to machine Z0 (audit 02-F3, P0, origin-crash).

**Files:**
- Modify: `src/app/ui/widgets/LaserCameraAidBackground/ExtractSquareTrace/index.jsx` (~127, 230–285)
- Modify: `src/server/services/machine/ConnectionManager.ts` (`goHome` G54 restore — already broadened in Task 4 Step 2; verify)

- [ ] **Step 1: Wrap the camera-aid G53 usage in try/finally** that always restores `G54` (and add a `.catch`), so an early return / photo failure / dialog close cannot leave G53 active:
```js
try {
    await this.props.server.executeGcode('G53;');
    // ... capture ...
} finally {
    await this.props.server.executeGcode('G54;');
}
```
- [ ] **Step 2: Prefer chaining over bare G53** where feasible: emit machine-coordinate moves as `G53 G0 X.. Y..` on one line (firmware applies G53 only for that line) instead of a standalone `G53;`. Apply to any other bare-`G53` emit found via `grep -rn "G53" src/`.
- [ ] **Step 3: Confirm Task 4's always-restore-G54** in `goHome` covers the homing leak path.
- [ ] **Step 4: Build + lint**, **Step 5: Commit** `Fix: Never leave machine in modal G53; always restore G54 (R7/02-F3)`.
- [ ] **Step 6: Manual validation (user, AT MACHINE):** Run a laser camera-aid background capture and cancel it midway; then press "Go To Work Origin". **Expected:** the move respects the work origin (no machine-Z0 plunge).

---

### Task 9: R10 — Guard against a stale work origin after homing/material/toolhead change

**Why:** The G54 offset survives homing (firmware-confirmed), so an origin saved on thicker stock / a different toolhead is silently re-applied; "Go To Work Origin" then drives below the current surface (audit 02-F4, P1, origin-crash).

**Files:**
- Create: `src/server/services/machine/originPlausibility.ts` + `test/originPlausibility.js`
- Modify: the "Go To Work Origin" handler to consult the guard and require confirmation when the Z target is below current Z.

- [ ] **Step 1: Write failing test** `test/originPlausibility.js`:
```js
import { test } from 'tape';
import { originMoveNeedsConfirm } from '../src/server/services/machine/originPlausibility';

test('originMoveNeedsConfirm flags descent below current Z', (t) => {
    // currentZ, originOffsetZ relative such that target work-Z0 is below current surface
    t.equal(originMoveNeedsConfirm({ currentZ: 5, targetMachineZ: -3 }), true, 'target below current => confirm');
    t.equal(originMoveNeedsConfirm({ currentZ: 5, targetMachineZ: 5 }), false, 'same level => ok');
    t.equal(originMoveNeedsConfirm({ currentZ: 5, targetMachineZ: 10 }), false, 'target above => ok');
    t.end();
});
```
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement helper:**
```ts
export function originMoveNeedsConfirm(p: { currentZ: number; targetMachineZ: number }): boolean {
    return p.targetMachineZ < p.currentZ; // descending below current head height needs a sanity check
}
```
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Wire a confirmation gate** into the "Go To Work Origin" UI: when `originMoveNeedsConfirm` is true, show a confirm dialog ("Work origin Z is below the current position — descend anyway?") before issuing the move. Use the position/origin data already in `workspace` redux (`workPosition`, `originOffset`) to compute the target machine Z.
- [ ] **Step 6: Build + lint**, **Step 7: Commit** `Fix: Confirm before Go-To-Work-Origin descends below current Z (R10/02-F4)`.
- [ ] **Step 8: Manual validation (user, AT MACHINE):** Set origin, raise Z, change to a "lower" origin scenario; press Go-To-Work-Origin → confirm dialog appears for descent; cancelling aborts the move.

---

### Task 10: Final review

- [ ] **Step 1:** `npm run eslint` (0 errors), `npx tsc --noEmit -p tsconfig-server.json` (exit 0), `npm test` (new tape tests pass).
- [ ] **Step 2:** Dispatch a code-review subagent over the full diff vs `chore/update-webpack-4-to-5` focusing on: no agent-introduced motion/laser calls, HTTP-path correctness, no regressions to the SACP branches (left intentionally unchanged).
- [ ] **Step 3:** Summarize for the user which fixes are code-verified vs awaiting their physical validation (Tasks 4, 7, 8, 9), with the manual scripts collected in one place.

---

## Notes / deferred

- SACP fixes R1/R2/R3 and SACP motion legs are deferred (machine uses HTTP over Wi-Fi). See `docs/superpowers/audits/SACP-protocol-reference.md`. Revisit if the user connects via USB-serial.
- Tier-3 hardening (R11/R12/R14–R20 beyond R20) not in this slice; tracked in the audit roadmap.
