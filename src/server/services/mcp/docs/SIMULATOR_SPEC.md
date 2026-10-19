# Machine simulator: a low-fidelity "game" scene that predicts collisions

Status: **specification, not started** (2026-09-07, operator request). Builds on the MCP server's
existing facts: the machine profile and heartbeat, the landmark store, keep-out volumes, probe
results (contacts, outlines, surface maps) and the confirm-page plan enumeration. The operator has
the Snapmaker A350 CAD model including the rotary module and its tailstock.

## 1. What it is for

1. **Predictive collision detection before approval.** Every staged procedure already enumerates
   its motion (hops, columns, marches, rotations) for the confirm page and the keep-out check. The
   simulator plays that same motion list through a 3D scene of the machine and everything known
   to be on the bed, and reports the first contact between the toolhead/probe/spindle envelope and
   any scene object that is not the intended probe target. The verdict goes on the confirm page
   next to the gcode, as a rendered frame at the moment of contact.
2. **A live, growing picture of the bed.** Each verified fact adds or refines an object: a landmark
   is a box, a `probe_stock_outline` result is a block with the measured size and yaw, a
   `probe_program` derived section is a bar on the rotary axis, a surface map is a height field, a
   `probe_circle` fit is a cylinder. Unverified estimates (the agent's guesses) render as ghosts.
   The scene persists per "session" (one clamping) and is reset deliberately.
3. **A visual check for the operator and the agent.** A camera view the operator can orbit, plus
   `capture`-style frames the agent can request, so a plan is judged on a picture, not on a list of
   coordinates.

It is NOT a physics engine, a CAM verifier or a digital twin with servo dynamics. Positions are
those the MCP already knows; motion is straight segments at the enumerated order; collision is
geometric overlap with a tolerance.

## 2. Architecture

```
                MCP server (Node, Electron main)                       Browser (confirm page / Workspace / standalone)
 ┌───────────────────────────────────────────────┐            ┌──────────────────────────────────────────────┐
 │ sceneStore.ts   scene objects + provenance     │  JSON/WS   │ sim page (three.js 0.124 already in Luban)    │
 │ kinematics.ts   A350 axis tree + limits        │ ─────────▶ │  - loads machine glTF (articulated nodes)     │
 │ sweep.ts        motion list -> sampled poses   │            │  - draws scene objects, ghosts, probe points   │
 │ collide.ts      envelope vs objects (pure)     │            │  - scrubs a plan; highlights first contact     │
 │ tools/scene.ts  MCP tools                      │ ◀───────── │  - operator marks objects (drag a box)        │
 └───────────────────────────────────────────────┘  actions    └──────────────────────────────────────────────┘
```

- **Server-side truth, browser-side rendering.** Collision prediction runs in the server
  (`collide.ts`, pure, unit-testable) so the confirm page verdict does not depend on a browser
  being open. The browser renders the same data and can replay it.
- **Rendering.** Luban already ships three.js (`SMCanvas`, `WorkspaceVisualizer`). Phase 1 uses a
  standalone page served by the MCP server at `/sim/<sessionId>` (loopback / LAN like the confirm
  page) loading three.js from the app bundle; Phase 3 embeds the same layer in the Workspace
  visualiser. The confirm page embeds a still frame (server-rendered is out of scope; the page
  renders it client-side from the plan and screenshots into the approval record).
- **Machine model.** Operator-supplied CAD (STEP) converted once to glTF with named articulated
  nodes: `bed` (moves in Y), `gantry_x` (moves in X on the bed frame? on the A350 the X carriage
  rides the gantry), `z_carriage`, `toolhead` (+ the fitted tool: probe/endmill as a child with
  its measured length), `rotary_base`, `chuck` (rotates about the axis line; children: jaws),
  `tailstock` (slides along Y; live centre). Node names are the contract; the converter script
  and a `machine-model.json` map node → axis → sign/offset. Envelope geometry for collision is a
  SIMPLIFIED convex set per moving part (boxes/cylinders), authored alongside the glTF, not the
  visual mesh.

## 3. Coordinates and kinematics

- Everything in **machine coordinates** (mm), the MCP convention (`machine = work − originOffset`).
  Work frames are display-only overlays.
- Axis tree from `get_machine_profile` (size 320 × 350 × 330, home (−19, 342, 328), X firmware
  limit 339) plus `machine-model.json`. Toolhead reference point = the controller's XYZ (the
  probe tip is at `z − probe_effective_length`, tip radius from `set_probe_geometry`).
- Rotary: axis line at `axis.x`, physical `axis.z` (from `set_probe_geometry`), along machine Y;
  B rotates `chuck` and every object attached to it. Tailstock Y position is an operator-marked
  landmark until measured.
- Time is not simulated; motion is sampled every `max(0.5 mm, segment/200)` along each segment
  in the enumerated order. Rotations are sampled every 5°.

## 4. Scene objects and provenance

```ts
interface SceneObject {
  id: string; name: string;
  kind: 'landmark-box' | 'keep-out' | 'block' | 'cylinder' | 'height-field' | 'point-cloud' | 'fixture-mesh';
  frame: 'machine' | 'chuck';            // chuck-attached objects rotate with B
  pose: { x, y, z, yawDeg?, b?: number };   // b = B angle at which the object was measured
  shape: { ... per kind: box size, radius/length, grid + zs, points[] };
  status: 'verified' | 'estimated' | 'operator';
  provenance: { source: 'landmark' | 'probe_stock_outline' | 'probe_program' | 'probe_surface_grid' | 'probe_circle' | 'operator' | 'agent'; jobId?: string; at: number; note?: string };
  clearanceMm: number;                    // inflation for collision (default 2; ghosts 5)
}
```

- **Verified** objects come only from probe results (the runner calls `sceneStore.add()` when a
  procedure completes: outline → block, four-face program → block on the chuck, surface grid →
  height field, circle → cylinder, every contact → point in a cloud) or from operator marks.
- **Estimated** objects are the agent's staging estimates (`probe_stock_outline` centre/size before
  it runs) and render as ghosts; a procedure that verifies them replaces the ghost.
- **Operator** objects are landmarks and keep-outs already stored, plus new marks drawn in the sim
  page (drag a box, set height) — written through the existing `set_landmark` path so the store
  stays single.
- A **session** = the set of objects since the last "new clamping" reset; sessions are saved as
  JSON under the app data dir (`mcp-scene/<session>.json`) and can be reloaded. Probe results keep
  their job ids so anything can be traced.

## 5. Collision prediction

Input: the motion list a planner already produces (`sequenceMotion`, `surfaceMotion`,
`outlineMotion`, `camMotion`, program rotations) plus the fitted tool. Output per plan:

```ts
interface CollisionReport {
  verdict: 'clear' | 'contact' | 'unknown';
  first?: { segment: string; at: Xyz; b: number | null; movingPart: string; object: string; penetrationMm: number };
  nearMisses: { segment: string; object: string; clearanceMm: number }[];   // < 5 mm
  intendedContacts: string[];   // marches whose target object is the surface they probe (not faults)
  coverage: 'full' | 'partial';  // partial if the scene has ghosts or unmeasured regions on the path
}
```

- Broad phase: AABB of the moving envelope per sample vs object AABBs. Narrow phase: box/box
  (separating axis, yaw only about Z), box/cylinder, box/height-field (sample the field under the
  tool footprint), point clouds inflated to spheres of tip radius.
- **Intended contact is not a collision:** a march's last `clearance + travel` mm toward its target
  object is expected; anything else touching (a hop clipping a jaw, a descent column landing on
  the tailstock bracket, the probe body brushing the chuck during a rotation) is a contact.
- Rotations: the swept volume of every chuck-attached object over the B range is checked against
  the toolhead envelope at its position of record; this is where the tailstock/handwheel and a long
  stock end matter.
- `unknown` when the path crosses regions with no verified object and the agent asked for a
  strict verdict; otherwise `clear` with `coverage: partial`. The confirm page prints the verdict,
  the first-contact frame, and the coverage; a `contact` verdict does not block staging (the
  operator decides) but is loud.

## 6. MCP tools (all read-only except scene edits, which are operator-confirmed)

| tool | purpose |
|---|---|
| `get_scene` | objects with provenance, session id, machine pose, B, fitted tool |
| `add_scene_estimate` | agent adds a ghost (estimated stock etc.); never verified |
| `mark_scene_object` | operator-confirmed (confirm page) box/cylinder → landmark/keep-out |
| `simulate_plan {job_id}` | run collision prediction on a staged job's motion list; also called automatically at staging and reported on the confirm page |
| `render_scene {view, job_id?}` | PNG frame (client-rendered via the sim page and posted back, or a server-side software rasteriser in Phase 2) |
| `reset_scene {reason}` | new clamping; archives the old session |

## 7. Phases

1. **Scene + collision core (server, pure).** `sceneStore`, `collide.ts` with unit tests on the
   known evidence (the 2026-09-05 rotary survey, the outlined block, the rotary-axis landmark,
   the tailstock note); planners call `simulate_plan` at staging; verdict + coverage on the confirm
   page as text. No rendering yet. Replays the two real incidents as regression tests: the
   2026-09-01 traverse into the rotary stock (must report contact) and job 34d787bdb2d7's hop at
   the traverse height (must report clear).
2. **Sim page.** `/sim/<session>` with three.js: machine glTF, articulated nodes driven by the
   heartbeat, scene objects, plan scrubber, first-contact highlight, operator box marking. Confirm
   page gets an embedded frame.
3. **Workspace layer + rendering tool.** Same scene as a toggleable layer in Luban's Workspace
   visualiser; `render_scene` frames for the agent; height fields from surface grids; camera
   frames (`capture_frame`) overlaid at their calibrated pose for visual cross-checks.
4. **Fidelity.** Tool library (endmill lengths/diameters from the tool setter history), probe body
   model, deflection allowance, gantry/Z-carriage envelopes checked against the machine's own
   limits, rotary swept volume of measured stock, tailstock position measurement procedure.

## 8. Inputs the operator must provide

- The CAD model (STEP or already glTF) of the A350 with rotary and tailstock, and permission to
  simplify it; the converter produces `machine.glb` + `machine-model.json` (node names, axes,
  envelope primitives). Kept out of the repository (size/licence) under the app data dir.
- Tailstock Y range and handwheel envelope until measured.
- Confirmation of the rotary axis position (already stored via `set_probe_geometry`).

## 9. Risks and limits

- Model accuracy: a CAD model of the machine is not the machine as clamped; every prediction is
  only as good as the verified objects. The verdict never replaces the crash guard, the keep-out
  check or the operator's approval; it adds a picture and an early warning.
- Probe length and tip are inputs; a re-fit without `set_probe_geometry` makes every Z wrong by
  the difference. The scene shows the fitted tool length so the operator can spot it.
- Height fields from sparse surface grids interpolate; the coverage flag says so.
- Rendering in the confirm page must not become a motion gate by itself: the click stays the gate.

## 10. Relationship to the existing pieces

Nothing here duplicates existing safety: laws 1–8, the crash guard, segmented descents, keep-out
checks and the confirm page stay exactly as they are. The simulator consumes the same motion lists
and stores, adds a geometric prediction and a picture, and gives the growing bed knowledge a
single home with provenance.
