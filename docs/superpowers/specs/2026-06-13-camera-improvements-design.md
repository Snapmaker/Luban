# Camera Module Improvements — Design Spec

**Date:** 2026-06-13
**Status:** Design only (no implementation). Future feature.
**Target:** Snapmaker A350, 10W laser module (onboard camera, `laserCamera:true` confirmed live), HTTP Wi-Fi.
**Grounded in:** code research (camera capture/calibration pipeline) + the Wi-Fi audit; file:line references throughout.

## Current state (what the camera does today)

The camera has exactly **one** use: the "Camera Capture" background aid — photograph the work platform, perspective-correct + stitch into a background image the user traces over (`src/app/ui/widgets/LaserCameraAidBackground/ExtractSquareTrace/index.jsx`). There is no other camera feature.

**Transport (decisive):** on the A350 over HTTP, `isUsingSACP()` is false (`ConnectionManager.ts:1540-1553`), so all camera traffic uses the **HTTP REST endpoints** in `src/server/lib/image-getPhoto.js` (`:8080/api/request_capture_photo`, `get_camera_image`, `request_10w_laser_camera_calibration`, `set_10w_laser_camera_calibration_matrix`). The SACP `0xb0` camera commands are *not* used here.

**10W capture flow** (`startCameraAid`, `index.jsx:123-278`): switch to machine coords (`G53`), fetch calibration `{points,corners}`, drive head to a **hardcoded** position `LASER_10W_TAKE_PHOTO_POSITION` (A350 = x232,y178,z290, `machines.ts:448-452`), take **1** photo, poll `get_camera_image` every 500 ms until ready, perspective-warp (single full-canvas homography via pure-JS `PerspT`, `image-stitch.js:91-112`), restore `G54`.

**Pixel→machine mapping:** a 4-point homography (`perspective-transform` lib, not OpenCV) using device-provided calibration corners; matrix stored on the device, fetched by Luban, overridable via `setMatrix` and the manual-corner-drag UI (`ManualCalibration/index.jsx:66-79`).

**Material thickness / focus:** a **manual user input** (`MaterialThicknessInput.tsx`) added to capture Z — not measured.

## Known pain points (from research, with file:line)

- Lens **undistortion is disabled** (`image-getPhoto.js:9` import commented; calls commented `:137,:165`); when it runs it hardcodes 1024×1280 (`imageRemap.ts:70-71`) and uses non-resetting module globals that leak across machine series (`imageRemap.ts:78,85-87`).
- 10W warp has its **bounds check commented out** (`image-stitch.js:100-102`) → corrupt edge pixels.
- Photo polling has **no overall timeout** (`index.jsx:331-459`); a stuck status never resolves.
- **Unguarded `JSON.parse(res.text)`** (`index.jsx:355,393,403`).
- Hardcoded everything: capture positions/Z, camera offsets (`cameraOffsetX=60`), `series:'A350'` and `centerDis:150` constants regardless of actual machine (`ManualCalibration.jsx:281-293`).
- Camera↔toolhead offset is a hardcoded constant, not read from the device; **current** toolhead position is never used — capture always drives to the fixed position.

## Opportunities, ranked by value / effort

| # | Opportunity | Value | Effort | Notes |
|---|---|---|---|---|
| 1 | **Robustness fixes** to the existing capture flow | High | Low | Polling timeout, guarded JSON.parse, fix/own undistortion dims, bounds check — directly reduces "camera capture failed/hung" frustration. Pairs with the audit's reliability theme. |
| 2 | **Job framing / position verification** | High | Med | Capture once, overlay the toolpath bounding box on the warped image so the user confirms the job lands on the material before running — prevents wasted/misplaced jobs. Reuses existing capture + homography. |
| 3 | **Live(-ish) preview** | Med | Med | Repeated single-shot refresh (e.g. 1–2 fps) of `get_camera_image` to give a near-live view for setup. No true MJPEG stream exists; this is polled stills. |
| 4 | **Camera-assisted focus/height** | Med | High | Net-new; see feasibility below. Ties to the curved-surface spec's acquisition problem. |

**Recommended first two:** #1 (robustness) then #2 (job framing) — highest value for the effort and they build directly on what exists.

### Opportunity 1 — robustness (detail)

- Add an overall timeout + cancel to the `get_camera_image` poll loop (`index.jsx:331-459`); surface a clear error instead of hanging.
- Wrap `JSON.parse(res.text)` in try/catch; treat malformed responses as a failed capture.
- Own the undistortion image dimensions (pass actual photo W/H instead of hardcoded 1024×1280) and reset `imageRemap` globals per series, or keep undistortion off and document it.
- Re-enable the 10W warp bounds check (`image-stitch.js:100-102`).

### Opportunity 2 — job framing / position verification (detail)

- After a single capture + warp (existing), render the current laser toolpath's bounding box (already known: `boundingBox` in the toolpath JSON, `generateGcode.js:177`) as an overlay on the warped platform image in machine coordinates (the homography already maps pixel↔machine).
- User confirms placement; optionally nudge work origin (reuses `setWorkOrigin`, now zero-axis-safe per Phase 2 R13) before running.
- No new device endpoints — pure client compositing on top of the existing capture.

### Opportunity 4 — camera-assisted focus/height (feasibility)

- **No depth-from-camera or focus-sweep code exists today**; this is fully net-new.
- The single-homography model assumes a **flat plane**, so it cannot recover height by itself. Real height from the camera would need either (a) multiple views / structured light (not available), or (b) a focus-sweep heuristic (capture at several Z, score sharpness) — slow and approximate.
- This is the most promising *automated* feeder for the curved-surface height map, but it's research-grade. Recommend prototyping a single-point focus-sweep first (measure Z-of-best-focus at one XY) and only generalize to a grid if accuracy is acceptable.

## Architecture notes

- Keep the HTTP path authoritative for this machine; don't assume SACP camera commands.
- Factor the pixel↔machine homography out of `image-stitch.js` into a small reusable module so framing (#2) and any future height work (#4) can share it.
- Robustness fixes (#1) are independent and shippable on their own.

## Dependencies on the curved-surface feature

- Opportunity 4 (camera focus/height) is the natural — but hard — automated source for the curved-surface **height map** (option C in that spec, currently parked). If #4's single-point focus-sweep proves accurate, a grid version could feed the height map and remove that spec's reliance on manual/import acquisition.

## Testing

- Unit (tape, pure helpers): the extracted homography module (pixel↔machine round-trip on known corners); a poll-timeout state machine.
- Integration: feed a saved photo + known calibration → assert warp output and toolpath-overlay placement.
- Manual (machine): capture flow completes with a timeout path that fails gracefully when the device is slow; framing overlay aligns with a ruler/known feature.

## Risks

- HTTP camera endpoints are undocumented/closed; behavior must be confirmed empirically per firmware (V1.21.0 here).
- Polling-based "live" preview adds load and is not smooth; set expectations (setup aid, not video).
- Camera-focus height (#4) may not reach usable accuracy; treat as a spike, not a commitment.

## Out of scope

- True MJPEG/RTSP video streaming (no firmware support found).
- Replacing the closed device-side calibration/matrix computation.
- SACP camera path on this (HTTP) machine.

## Success criteria

- #1: camera capture never hangs indefinitely and reports clear errors; undistortion either works with correct dims or is cleanly disabled.
- #2: a captured, perspective-corrected platform image with an accurate toolpath-placement overlay the user can confirm before running a job.
