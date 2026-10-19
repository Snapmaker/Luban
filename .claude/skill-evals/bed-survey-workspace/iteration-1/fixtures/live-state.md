# Stand-in tool results (hypothetical fixture, modelled on the box on 2026-10-04)

These are what the read-only calls WOULD return if you made them at the start of the session.
They are fixtures for a dry run, not a live machine. Quote them as "fixture" when you use them.
Anything not listed here is live-unknown: name the call that would return it and branch.

Build: PR #219 (`codex/camera-program-active-tool`, bbef661ad), deployed to the Ubuntu box
2026-10-04 12:20 BST. Luban was relaunched for the deploy; the operator has since clicked Connect.
The full live tool list (names, descriptions, input schemas) is `tools-list.json` beside this file.
That is exactly what a live agent sees in `tools/list`.

## get_connection_status
```json
{"connected": true, "channelName": "sstp-http", "connectionType": "wifi", "machineIdentifier": "A350", "machineReady": true}
```

## get_position
```json
{"machine": {"x": 150.2, "y": 210.4, "z": 296.0, "b": 180.0}, "reliability": "heartbeat", "frame": "work-offset",
 "warnings": [], "isHomed": false, "machineStatus": "IDLE",
 "originOffset": {"x": -118.8, "y": -77.2, "z": -79.0}, "reportAgeMs": 900,
 "reasons": ["coherent beat; controller has not been homed since Luban reconnected"]}
```

## get_active_tool
```json
{"active": null, "note": "No active tool is confirmed. Route planners use the legacy configured worst-case values where available and refuse physical obstacles they cannot bound."}
```

## get_stored_state (abridged; values verbatim)
- `landmarks`:
  - `tool-setter`: machine box X38..89, Y269..303, legacy `clearanceZ` 328 (toolhead basis). Setter centre (79, 293);
    air-blast post centre (49.691, 280.707), top physical ~106.9. Notes 2026-08-31 / 2026-09-02.
  - `rotary-axis`: machine box X140..200, Y0..350, legacy `clearanceZ` 328 (toolhead basis). "Rotary module along the
    centre of the bed at machine X~170, axis along Y: chuck face ~Y300-310 (housing behind to Y340+), tailstock with live
    centre at ~Y95 (its bracket+handwheel stand ABOVE stock top - keep-out Y<110)." The stock description in this
    record (square wooden stock, top physical 136.5, 2026-09-02) is from an earlier clamping.
- `landmarkClearances`: `toolProtrusionMm` 75, source `longest-bit` ("longer than the last tool-setter measurement 74.8 mm,
  the touch probe's effective length 70.9 mm. Nothing reports which tool is actually fitted"). Both landmarks are on the
  legacy basis.
- `limits`: `maxJogDistanceMm` 100, `safeTraverseZMm` 328, `motionFloorZMm` 320.
- `toolSetter`: centre (79, 293), `triggerZ` 175.5 with reference bit 75, `longestBitLengthMm` 75, change park X339 Z328.
- `geometry`:
  - `probe_effective_length` 70.9: "run_tool_setter job 5ce60989dc03, 2026-09-29 ~12:37 BST, after the operator refitted
    the probe: contact Z171.4 x3, spread 0, setter physical surface 100.5 -> 70.9".
  - `probe_tip_diameter` 2 (operator-stated 2026-09-29).
  - `rotary_axis_x` 170.1, `rotary_axis_z_physical` 112.4 (config, undated - historical); `rotary_tailstock_y` and
    `rotary_chuck_face_y` unset.
  - travel X -19..339, Y 0..342 (stated 2026-09-20).
- `camera`: device pinned `/dev/v4l/by-id/usb-Generic_USB_Camera_200901010001-video-index0 (USB Camera: USB Camera)`;
  stream enabled, `stream_url` https://192.168.1.153:40890/camera.
- `calibrations`: [] (no 2x2 pixel/mm calibrations stored).
- `probeFeed`: transport gpio (KB2040 U2IF), connected, toolsetter/overtravel/probe channels enabled and idle, `ok: true`.

## get_camera_model
```json
{"model": null, "usable": false, "state": "unverified", "next": "camera_bootstrap",
 "reasons": ["No camera model has been solved on this machine. ... run camera_bootstrap. Plain captures are unaffected - a frame finds things, it clears nothing."]}
```

## list_cameras
Two devices attached: the pinned Generic USB Camera above and
`/dev/v4l/by-id/usb-icSpring_icspring_camera-video-index0 (icspring camera: icspring camer)`.

## get_mcp_diagnostics -> buffers
`jobEventLimit` 2000 (spindle telemetry off), `diagnosticsRecentLimit` 40.

## Job history (server job list)
Probing jobs of the QuadEink enclosure pocket from 2026-09-21/22 exist on the server, among them
031c3eb1fe38 (pocket outline, B180) and d677bd88d31a (closed perimeter trace). Their
results are retrievable with `get_gcode_job_status` / `get_inspection_report`. Nothing
records whether the enclosure has been unclamped, re-clamped or rotated since then.
