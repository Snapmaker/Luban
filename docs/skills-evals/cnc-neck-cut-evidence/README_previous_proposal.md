# Enclosure neck cutting proposal — 2026-09-26

Open [neck_cut_proposal.FCStd](neck_cut_proposal.FCStd) in FreeCAD. Its saved opening view shows Y256 cross sections: the intermediate web on the left and the two final tabs on the right. [JPEG of the FreeCAD opening view](freecad_opening_view.jpg). `ExistingChannels` contains measured-depth groove proxies; `RemovalTargets` and `RetainedWeb` show the proposed side milling. `DraftCAM` contains two native `Path::Feature` trajectories in **setup-local coordinates**. They are deliberately outside a CAM Job and have no postprocessor. The X spacing between FreeCAD exhibits is for display only; do not run or post these coordinates on the Snapmaker.

## Probe evidence (all contacts in machine frame)

The fitted touch probe has effective length 70.95 mm and about 21 mm of exposed tip. Surface heights below are **toolhead Z**, not physical surface Z.

| Face | Measured reference | Channel at machine Y256 | Inferred cut depth |
| --- | --- | --- | --- |
| B0 top | Z201.3 at X145/170/195, Y240–252 | Z192.2 / 192.1 / 192.2 at X145/170/195 | **9.1 / 9.2 / 9.1 mm** |
| B180 underside | Z204.5 rim at X198, Y250–253 | Z198.4 at X198, Y254–258 | **6.1 mm** at this sample |

The B0 direct floor probe is job `b32add0404af`; all three contacts had zero reported confirmation spread. The B180 contact came from the earlier underside profile.

Side-silhouette job `97ff89e230a5` probed X from both sides at the same toolhead Z213 (about 4 mm below each measured side top). The probe-center shifts directly measure groove depth at that lateral slice; the 1.25 mm tip-radius correction cancels when subtracting same-side contacts.

| Orientation | Y245 west / east | Y256 west / east | Inward edge shifts |
| --- | --- | --- | --- |
| B90 | X151.5 / 190.4 | X160.5 / 184.3 | **9.0 / 6.1 mm** |
| B270 | X148.3 / 187.1 | X154.3 / 178.1 | **6.0 / 9.0 mm** |

The paired 9 mm shifts correspond to the B0 groove and agree with its direct floor probes. The paired 6 mm shifts correspond to B180 and agree with its direct profile. The physical side opening at Y256 is **21.3 mm** in both orientations: `(east − west) − 2.5 mm probe diameter`. At Y245 the outside side width was 36.3–36.4 mm. The B0 outside X width at Y245 was 64.1 mm (physical faces X137.85–201.95).

## Tabbed cutting proposal

The previous 14.1 × 21.2 mm continuous web was too much material to leave for the saw. The revised FreeCAD document has two stages:

1. **Intermediate support:** extend the existing B0/B180 slot from B90 and B270, cutting the remaining axial band to **24 mm depth from each side** in twelve 2 mm depth levels. The nominal continuous web after these cuts is **16.1 × 21.2 mm** (341 mm²). This intermediate web keeps the enclosure attached while most milling is done.
2. **Tabbed finish:** selectively deepen the B0 channel to a total 15.7 mm from its outer face and the B180 channel to a total 12.7 mm from its outer face. This leaves an 8 mm high central band. Clear a **6.5 mm radial gap** through the middle of that band using approaches from both opposite faces; the conceptual depth limit is 20 mm from either outer face, within the user's reported >25 mm flute. The two remaining bridges are nominally **4.8 × 8 mm** in the cross section, at diagonally opposite corners of the intermediate web (centers about 17.4 mm apart), with a cutter-access gap between their radial extents. They bridge the nominal Y253–259 kerf.
3. **Final saw:** cut the two bridges, a total nominal cross-sectional area of **76.8 mm²**. That is about 77% less material to saw than the intermediate 341 mm² web. The enclosure remains connected until this final step.

The FreeCAD `HoldingTabs` group models this final target and the additional material to remove. `DraftCAM` currently contains only the two **intermediate side paths**; the tab finishing cuts are solids and sequence intent, not machine-ready CAM. Their order, entry method, exact tool-center offsets and collision clearance require simulation after the endmill is fitted. The 4.8 × 8 mm tab dimensions are provisional: wood grain, fixture stiffness, enclosure mass and vibration were not measured. Retain larger bridges if the intermediate stage shows movement, and only reduce them after inspection. The central 6.5 mm gap gives just 0.25 mm nominal clearance per side around a 6 mm cutter, so runout and positional tolerance must be checked.

This is a cutting **proposal**, not a released machine program. The 64.1 mm opposed width was measured at Y245, and the housing has a cavity and curved transitions; the rectangular solid in FreeCAD is an envelope. Before generating machine-frame CAM, measure the installed endmill length, confirm usable flute and collet clearance at 24 mm side depth and 20 mm opposite-face depth, verify rotary datum and workholding, and simulate the cut with the measured Y256 silhouette. The existing probe is still fitted; no milling has been executed.
