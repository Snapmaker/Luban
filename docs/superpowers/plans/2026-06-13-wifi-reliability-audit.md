# Luban Wi-Fi Reliability Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Root-cause Luban's Wi-Fi reliability symptoms (slow homing, stale machine state, unsafe go-to-work-origin) via a four-dimension code audit cross-referenced against firmware, produce a ranked findings report, generate a Phase 2 fix plan from it, and write two future-feature design specs.

**Architecture:** Read-only audit subagents sweep the server-side machine-control stack (`src/server/services/machine/**`) and the `Snapmaker2-Controller` firmware, emitting structured findings to `docs/superpowers/audits/raw/`. The main session verifies and ranks findings into a final report, then a checkpoint with the user selects the fix list and a separate fix plan is written. Feature specs are independent of fixes.

**Tech Stack:** Serena MCP (symbolic code reading), Explore subagents (read-only), Chrome DevTools MCP (optional live observation of the Electron renderer), git.

**Spec:** `docs/superpowers/specs/2026-06-13-wifi-reliability-audit-design.md`

**Branch:** `audit/wifi-reliability` (off `chore/update-webpack-4-to-5`)

---

## Context every worker must know

- Luban v4.15.2 fork. Machine: Snapmaker 2.0, Wi-Fi, recent (SACP-capable) firmware, 10W laser module, enclosure.
- **Wi-Fi topology caveat:** the machine's Wi-Fi HTTP/SACP server runs on the closed-source touchscreen (Android). `../Snapmaker2-Controller` is the motion controller; it talks to the screen over UART (`snapmaker/src/hmi/event_handler.cpp`). Firmware is ground truth for motion/homing/module behavior, NOT for the network protocol surface.
- **SAFETY (hard limits, applies to any live-machine step):** Allowed: Wi-Fi connect/disconnect, read-only state queries, enclosure light/fan toggle, laser-module camera capture. Forbidden: ALL motion commands, laser power at any level, heaters, writing work origin, starting jobs.
- Audit subagents are READ-ONLY: no file edits, no network calls to the machine.

### Findings schema (used by all audit tasks)

Each finding in a raw findings file uses exactly this markdown structure:

```markdown
## F<n>: <one-line title>
- **Location:** `<file>:<line>` (and related locations)
- **Severity:** P0 (causes user's symptoms) | P1 (likely reliability bug) | P2 (latent risk/code smell)
- **Symptom mapping:** slow-homing | state-desync | origin-crash | none
- **Confidence:** high | medium | low
- **What happens:** <2-6 sentences: mechanism of the bug, citing actual code behavior>
- **Evidence:** <code excerpts / call-chain showing it>
- **Proposed fix:** <1-4 sentences, concrete>
- **Upstream-relevant:** yes | no (does this exist in Snapmaker/Luban upstream too?)
```

---

### Task 1: Audit working area setup

**Files:**
- Create: `docs/superpowers/audits/raw/.gitkeep`

- [ ] **Step 1: Verify branch and create directories**

```bash
git rev-parse --abbrev-ref HEAD   # Expected: audit/wifi-reliability
mkdir -p docs/superpowers/audits/raw
touch docs/superpowers/audits/raw/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/raw/.gitkeep
git commit -m "Chore: Scaffold audit working area"
```

---

### Task 2: Audit dimension 1 — State synchronization (→ state-desync symptom)

**Files:**
- Create: `docs/superpowers/audits/raw/01-state-sync.md`

- [ ] **Step 1: Dispatch a read-only Explore subagent with exactly this prompt**

```text
You are auditing Snapmaker Luban (repo: /Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Luban)
for STATE SYNCHRONIZATION bugs over the Wi-Fi connection to a Snapmaker 2.0.
READ-ONLY: do not edit files, do not contact any machine.

User-reported symptom you must explain: Luban's view of machine state goes stale /
out of sync with the machine — e.g. whether the laser module is on, module attach
state, workflow status.

Audit these code paths end to end:
1. src/server/services/machine/channels/SacpChannel.ts — every `subscribe*` call,
   heartbeat handling, and how subscription callbacks mutate cached state.
2. src/server/services/machine/channels/SacpTcpChannel.ts — connection open/close,
   what gets (re)subscribed when, and what is NOT resubscribed after reconnect.
3. src/server/services/machine/channels/SstpHttpChannel.ts — the polling loop:
   interval, error handling when a poll fails, fields polled vs fields the UI shows.
4. src/server/services/machine/sacp/SacpClient.ts — subscription dispatch, ack
   handling, any place a response can be dropped/mismatched.
5. src/server/services/socket/machine-handlers.ts — which events reach the client.
6. src/app/flux/machine/ and src/app/flux/workspace/ — how the renderer stores
   machine state; find fields that are written on connect but never refreshed.

Questions to answer with file:line evidence:
- Which state fields are event-driven (SACP subscription) vs polled vs write-once?
- What happens to each cached field on: reconnect, channel switch (HTTP<->SACP),
  module hot-plug, machine-side change (e.g. laser toggled from touchscreen)?
- Are there divergent state models between SstpHttpChannel and SacpChannel (same
  field, different semantics/units/update cadence)?
- Find stale-cache bugs: state captured in closures, module-level singletons that
  survive disconnect, listeners registered twice after reconnect.
- How does Luban learn laser-module on/off specifically? Trace the full path
  machine -> channel -> socket event -> redux -> UI.

Write findings to docs/superpowers/audits/raw/01-state-sync.md . You may write ONLY
this one file. Use exactly this schema for each finding:
[findings schema from the plan's "Findings schema" section — copy it verbatim]
End the file with a "## Coverage" section listing files you read and anything you
could not determine statically (so the live-observation task can target it).
```

(When dispatching, replace the schema placeholder line with the verbatim schema block from this plan's "Findings schema" section.)

- [ ] **Step 2: Sanity-check the output**

Read `docs/superpowers/audits/raw/01-state-sync.md`. Verify: every finding has file:line, severity, confidence; the laser on/off path is traced; a Coverage section exists. If not, re-dispatch with the gaps named.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/raw/01-state-sync.md
git commit -m "Docs: Audit raw findings - state synchronization"
```

---

### Task 3: Audit dimension 2 — Motion safety (→ slow-homing + origin-crash symptoms)

**Files:**
- Create: `docs/superpowers/audits/raw/02-motion-safety.md`

- [ ] **Step 1: Dispatch a read-only Explore subagent with exactly this prompt**

```text
You are auditing Snapmaker Luban (repo: /Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Luban)
for MOTION SAFETY bugs over the Wi-Fi connection to a Snapmaker 2.0.
READ-ONLY: do not edit files, do not contact any machine.

User-reported symptoms you must explain:
A) "Go home" sometimes runs much slower than expected.
B) "Go to work origin" can drive the toolhead into the bed.

Audit these code paths end to end:
1. src/server/services/machine/ConnectionManager.ts — find every function that can
   produce motion: goHome, coordinate moves, work-origin set/restore, run-boundary,
   start-job preamble. For each: the exact G-code or SACP command emitted, the
   feedrate used (or omitted!), and the ORDER of axis moves.
2. src/server/services/machine/channels/SacpChannel.ts + sacp/SacpClient.ts — the
   SACP move/home request implementations these call.
3. src/server/services/machine/channels/SstpHttpChannel.ts — same commands on the
   HTTP path; compare against the SACP path for divergence.
4. src/app/ui/widgets/Console and src/app/flux/workspace — what the UI sends for
   "go to work origin" / homing buttons (search for G28, G53, G54, G92, G0/G1 with Z).
5. Cross-reference firmware ground truth in
   /Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Snapmaker2-Controller :
   - Marlin/src/gcode/ + snapmaker/src/ for G28 handling and homing feedrates
   - snapmaker/src/module/linear.cpp (homing, endstops)
   - snapmaker/src/hmi/event_handler.cpp (motion commands the screen can issue)
   Determine: what feedrate does firmware use when Luban omits F? Does firmware
   modal state (G90/G91, G53/G54, last feedrate) persist across Luban commands?

Questions to answer with file:line evidence:
- For "go to work origin": is Z moved before, after, or simultaneously with XY?
  Is the move done in workspace or machine coordinates? What if the saved origin
  is below the current surface or was saved with a different toolhead/material
  thickness?
- For homing: which command is sent, with what feedrate; does any code path send
  moves with a stale/low modal feedrate (explains slowness)? Any double-homing?
- Are there guards (boundary check, Z-lift before XY travel) anywhere? Where are
  they missing?
- Race conditions: can a user-triggered move interleave with a job preamble or
  another queued move?

Write findings to docs/superpowers/audits/raw/02-motion-safety.md . You may write
ONLY this one file. Use exactly this schema for each finding:
[findings schema from the plan's "Findings schema" section — copy it verbatim]
End the file with a "## Coverage" section listing files read and open questions.
```

- [ ] **Step 2: Sanity-check the output**

Read `docs/superpowers/audits/raw/02-motion-safety.md`. Verify both symptoms A and B have at least one candidate root cause each with a traced command sequence (or an explicit "not found statically" note), and firmware feedrate behavior is documented.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/raw/02-motion-safety.md
git commit -m "Docs: Audit raw findings - motion safety"
```

---

### Task 4: Audit dimension 3 — Connection lifecycle

**Files:**
- Create: `docs/superpowers/audits/raw/03-connection-lifecycle.md`

- [ ] **Step 1: Dispatch a read-only Explore subagent with exactly this prompt**

```text
You are auditing Snapmaker Luban (repo: /Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Luban)
for CONNECTION LIFECYCLE bugs over the Wi-Fi connection to a Snapmaker 2.0.
READ-ONLY: do not edit files, do not contact any machine.

Context: connection problems can underlie all the user's symptoms (slow homing,
stale state, bad origin moves) if commands go to a half-dead or duplicated channel.

Audit these code paths end to end:
1. src/server/services/machine/ConnectionManager.ts — connectionOpen/Close paths,
   how the active channel is selected and stored, what happens on failed connect.
2. src/server/services/machine/ProtocolDetector.ts — how SACP vs HTTP is chosen
   for a Wi-Fi SM 2.0; what happens when detection is wrong or flaps.
3. src/server/services/machine/channels/SacpTcpChannel.ts and SstpHttpChannel.ts —
   socket open/close/error/timeout handlers, heartbeat start/stop, reconnect logic,
   event listener registration (find listeners added on every connect but never
   removed — EventEmitter leaks mean duplicated handling).
4. src/server/services/machine/MachineDiscoverer.ts + network-discover/ — discovery
   affecting an already-connected machine.
5. src/server/services/socket/machine-handlers.ts + socket/index.ts — client socket
   disconnect/reconnect (e.g. renderer reload) vs server-side channel state.

Questions to answer with file:line evidence:
- Enumerate every `.on(` registration in the channel classes: which are inside
  connect paths and lack a matching `.off(`/`removeListener` on disconnect?
- Is there exactly one channel instance per protocol (singletons)? What state do
  singletons retain across connect cycles?
- Heartbeat: what timeout, what happens on miss — does Luban know the connection
  died? Can a dead connection look alive to the UI?
- Channel switch: can both SstpHttpChannel and SacpTcpChannel be active or polling
  simultaneously? What stops the old one?
- Renderer reload / second client tab: does the server keep the machine connection,
  and does the new client get a full state snapshot or partial?

Write findings to docs/superpowers/audits/raw/03-connection-lifecycle.md . You may
write ONLY this one file. Use exactly this schema for each finding:
[findings schema from the plan's "Findings schema" section — copy it verbatim]
End the file with a "## Coverage" section listing files read and open questions.
```

- [ ] **Step 2: Sanity-check the output**

Read `docs/superpowers/audits/raw/03-connection-lifecycle.md`. Verify the listener-leak enumeration was actually done (a table of `.on(` sites is present) and heartbeat behavior is documented.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/raw/03-connection-lifecycle.md
git commit -m "Docs: Audit raw findings - connection lifecycle"
```

---

### Task 5: Audit dimension 4 — Command/ack robustness

**Files:**
- Create: `docs/superpowers/audits/raw/04-command-robustness.md`

- [ ] **Step 1: Dispatch a read-only Explore subagent with exactly this prompt**

```text
You are auditing Snapmaker Luban (repo: /Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Luban)
for COMMAND/ACK ROBUSTNESS bugs in the SACP and HTTP command paths to a Snapmaker 2.0.
READ-ONLY: do not edit files, do not contact any machine.

Audit these code paths end to end:
1. src/server/services/machine/sacp/SacpClient.ts — request/response correlation
   (sequence numbers), per-request timeouts (find requests with NO timeout), retry
   behavior, error propagation; what happens to in-flight requests on disconnect.
2. src/server/services/machine/channels/SacpChannel.ts — every public command
   method: does it await the ack? Does it surface failure to the caller or swallow
   it? Find fire-and-forget commands whose failure leaves Luban's state wrong.
3. src/server/services/machine/channels/SstpHttpChannel.ts — HTTP request error
   handling, status-code checking, JSON parse failures, request queuing/serialization
   (can two requests interleave incorrectly?).
4. src/server/services/machine/ConnectionManager.ts — does it check channel-method
   results? Find `async` calls whose rejection is unhandled (unhandledRejection
   risk crashes or silently kills flows).
5. The packet layer used by SacpClient (follow its imports, e.g. packages/ or
   node_modules @snapmaker — note which) — framing errors, partial TCP reads,
   buffer concatenation bugs.

Questions to answer with file:line evidence:
- Table of all SacpClient request methods: timeout? retry? error surfaced?
- What happens if the machine acks a command but its response arrives after the
  internal timeout, or out of order? Is the sequence-number space ever reused while
  a request is pending?
- Identify every `catch` that logs-and-continues where the caller assumes success.
- Is there backpressure/serialization for commands during a running job?

Write findings to docs/superpowers/audits/raw/04-command-robustness.md . You may
write ONLY this one file. Use exactly this schema for each finding:
[findings schema from the plan's "Findings schema" section — copy it verbatim]
End the file with a "## Coverage" section listing files read and open questions.
```

- [ ] **Step 2: Sanity-check the output**

Read `docs/superpowers/audits/raw/04-command-robustness.md`. Verify the request-method table exists and the packet/framing layer was identified by path.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/raw/04-command-robustness.md
git commit -m "Docs: Audit raw findings - command/ack robustness"
```

**Note:** Tasks 2–5 are independent and SHOULD be dispatched in parallel (one message, four Agent calls). Sanity-check and commit each as it completes.

---

### Task 6: Firmware cross-verification of P0/P1 findings

**Files:**
- Modify: `docs/superpowers/audits/raw/01-state-sync.md` … `04-command-robustness.md` (append verification notes only)

- [ ] **Step 1: Collect all P0 and P1 findings from the four raw files**

List them with their claimed mechanisms.

- [ ] **Step 2: For each P0/P1 finding whose mechanism depends on firmware behavior, verify against `../Snapmaker2-Controller`**

Use Serena/Grep on the firmware repo. Typical ground-truth locations:
- Homing: `Marlin/src/gcode/calibrate/G28.cpp` (or equivalent path found via grep for `G28`), `snapmaker/src/module/linear.cpp`
- Module state reporting cadence: `snapmaker/src/module/toolhead_laser.cpp`, `snapmaker/src/common/` message defs
- Screen-issued commands: `snapmaker/src/hmi/event_handler.cpp`
- Quick stop / motion interleaving: `snapmaker/src/service/quick_stop.cpp`, `snapmaker/src/service/system.cpp`

- [ ] **Step 3: Append a `### Firmware verification` subsection to each verified finding**

State: confirmed / refuted / firmware-dependent-unknowable (network layer on closed screen), with firmware file:line evidence. Downgrade or upgrade severity/confidence accordingly.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/raw/
git commit -m "Docs: Firmware cross-verification of P0/P1 audit findings"
```

---

### Task 7: Optional live read-only observation (SKIPPABLE — requires machine + user consent at run time)

**Precondition:** Machine powered on, on LAN; user confirms. If unavailable, mark task skipped in the plan and move on — the report must note which findings remain unconfirmed statically.

**SAFETY:** Only the allowed operations (connect, read state, enclosure light/fan, camera). NO motion, NO laser power, NO origin writes, NO job start.

- [ ] **Step 1: Start Luban in dev mode** (`npm run dev` per package.json scripts; confirm server + Electron come up)
- [ ] **Step 2: Connect to the machine over Wi-Fi from the Luban UI** (user may need to tap "confirm" on the touchscreen)
- [ ] **Step 3: Attach Chrome DevTools MCP to the renderer; snapshot redux machine state** (`new_page`/`list_pages` then `evaluate_script` reading the store) and server-side channel state (add temporary `log.info` only if needed — revert after)
- [ ] **Step 4: Targeted desync reproduction, read-only:** toggle enclosure light/fan from the TOUCHSCREEN and check whether Luban's UI updates; compare polled vs subscribed fields listed by Task 2's Coverage section
- [ ] **Step 5: Append observations** to the relevant raw findings files under `### Live observation`, commit as `Docs: Live read-only observations`

---

### Task 8: Ranked audit report

**Files:**
- Create: `docs/superpowers/audits/2026-06-13-wifi-connection-audit.md`

- [ ] **Step 1: Write the report** with this exact structure:

```markdown
# Luban Wi-Fi Connection Reliability Audit — Snapmaker 2.0
## Executive summary            (≤ 1 page: the 3 symptoms, their most likely root causes)
## Symptom → root-cause map     (table: symptom | finding IDs | confidence)
## Ranked findings              (all P0s, then P1s; each: copied finding + verification status)
## P2 / latent risks            (bullet list, one line each, finding IDs)
## Improvement roadmap          (ordered fix list proposed for Phase 2, effort estimates S/M/L)
## Methodology & coverage       (what was audited, what wasn't, unconfirmed items)
```

Rank by: (1) maps to a user symptom, (2) severity, (3) confidence, (4) fix effort.

- [ ] **Step 2: Self-review the report** — every claim traceable to a raw finding with file:line; no finding contradicts its firmware verification; roadmap items are concrete.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/2026-06-13-wifi-connection-audit.md
git commit -m "Docs: Wi-Fi connection reliability audit report"
```

---

### Task 9: CHECKPOINT — user review + Phase 2 fix plan

- [ ] **Step 1: Present the report to the user.** Walk through the symptom → root-cause map and the proposed fix list. User selects/edits the fix list (expect 3–6 fixes within the ~4–5h budget).

- [ ] **Step 2: Invoke the superpowers:writing-plans skill** to write `docs/superpowers/plans/2026-06-13-wifi-reliability-fixes.md` covering the agreed fixes. That plan MUST: follow TDD for unit-testable logic; include a manual live-validation script (user-executed) for every motion-related fix; respect the safety protocol (no agent-driven motion); target branch `audit/wifi-reliability`.

- [ ] **Step 3: Execute the fix plan** per its own header (subagent-driven or inline, user's choice).

---

### Task 10: Feature spec — curved-surface laser etching

**Files:**
- Create: `docs/superpowers/specs/2026-06-13-curved-surface-laser-etching-design.md`

- [ ] **Step 1: Targeted recon (read-only).** Locate and skim:
  - Laser toolpath generation: `src/server/services/task-manager/workers/` (laser G-code generators; find via grep for `generateGcode` / `laser`)
  - Existing rotary (4-axis B) laser support — closest precedent for non-planar etching (grep `rotary` in laser editor + workers)
  - Material-thickness / focus handling: grep `materialThickness`, `zOffset`, `focal` in `src/app/` and `src/server/`
  - 10W laser module firmware capabilities: `../Snapmaker2-Modules/Marlin/src/module/` laser module sources (look for IR/proximity/height sensing support) and `../Snapmaker2-Controller/snapmaker/src/module/toolhead_laser.cpp`

- [ ] **Step 2: Write the design doc** with sections: Problem & goal; Height-acquisition options (laser-module sensor vs camera photogrammetry vs manual probe grid — compare accuracy/speed/hardware-needs, pick one primary); Height-map data model; Toolpath generation changes (Z-modulated moves: which worker, what new parameters, G-code shape with example block); Machine-control changes (any new SACP/G-code needs, firmware-touching? keep local); UI changes (minimal); Safety considerations (Z clearance, never below surface); Risks; Out of scope. Ground every claim in file paths found in Step 1.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-curved-surface-laser-etching-design.md
git commit -m "Docs: Design spec - curved-surface laser etching"
```

---

### Task 11: Feature spec — camera module utilization

**Files:**
- Create: `docs/superpowers/specs/2026-06-13-camera-improvements-design.md`

- [ ] **Step 1: Targeted recon (read-only).** Locate and skim:
  - Existing camera-capture path: grep `camera` in `src/server/services/` and `src/app/ui/widgets/` (camera-aid background / calibration code)
  - Camera APIs available: `src/server/services/machine/sacp/SacpClient.ts` camera-related requests + HTTP camera endpoints in `SstpHttpChannel.ts`
  - 10W-laser-module camera specifics in `../Snapmaker2-Modules` sources

- [ ] **Step 2: Write the design doc** with sections: Current state (what Luban does with the camera today, with file paths); Opportunity list ranked by value/effort (e.g. faster capture flow, focus/height estimation, toolhead-position verification, job time-lapse); For the top 2 opportunities: data flow, API/protocol needs, UI touchpoints; Dependencies on the curved-surface feature (shared height-sensing?); Risks; Out of scope.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-camera-improvements-design.md
git commit -m "Docs: Design spec - camera module improvements"
```

---

## Execution notes

- Task order: 1 → (2,3,4,5 in parallel) → 6 → 7 (optional) → 8 → 9 (checkpoint) → 10 → 11. Tasks 10–11 can run while the user reviews the Task 8 report.
- Time budget guidance: Tasks 1–8 ≈ 3–4h, Task 9 (incl. fix plan execution) ≈ 4–5h, Tasks 10–11 ≈ 1–2h.
- All audit subagents are read-only; the only file writes in Tasks 2–7 are the designated findings files.
