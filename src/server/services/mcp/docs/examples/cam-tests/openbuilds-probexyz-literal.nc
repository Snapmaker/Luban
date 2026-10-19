(DERIVED FILE - written by the research agent 2026-09-07, not by OpenBuilds.)
(Source: OpenBuilds CONTROL app/wizards/interface/PROBE/PROBEXYZ.PRB, GPL-3.0,)
(  https://github.com/OpenBuilds/OpenBuilds-CONTROL - retrieved 2026-09-07.)
(Transformation: the three "G10 P0 L20 ..." work-offset lines carrying the)
(  <zoffset>/<xoffset>/<yoffset> template substitutions were deleted - our parser)
(  refuses G10 outright - and the "G1 F1000" bare feed line was folded into the)
(  following motion. Nothing else changed: every coordinate is upstream's.)
(Geometry: the OpenBuilds XYZ Probe Plus, a 45 x 45 mm plate; the routine starts)
(  with the tool jogged over the plate corner region and treats that as X0 Y0 Z0.)
(Exercises: Z touch-off, then X edge, then Y edge, with G91/G90 flips, G4 dwells)
(  and a mm-mode G21 header. 3 probe cycles.)
G21
G90
G1 X22.5 Y22.5 F1000
G38.2 Z-25 F100
G4 P0.4
G91
G1 Z5 F1000
G90
G1 X-20 Y10 F1000
G91
G1 Z-11 F1000
G90
G38.2 X25 F100
G4 P0.4
G91
G1 X-2 F1000
G1 Z11 F1000
G90
G1 X15 Y-20 F1000
G91
G1 Z-11 F1000
G38.2 Y25 F100
G90
G4 P0.4
G91
G1 Y-2 F1000
G1 Z11 F1000
G90
G1 X0 Y0 F1000
M30
