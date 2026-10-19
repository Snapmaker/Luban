(DERIVED FILE - written by the research agent 2026-09-07.)
(Same motion as openbuilds-probexyz-literal.nc, with our own -PROBE- metadata)
(comments added so the report renderers have nominals, normals and tolerances)
(to work from. No upstream project emits this annotation - it is ours - so this)
(is the only fixture in the collection that exercises parseProbeMeta and the)
(deviation / withinTolerance / G800-G801 nominal columns end to end.)
(Nominals assume the OpenBuilds XYZ Probe Plus is set up so the plate top is)
(work Z0 and the probed X and Y faces sit on work X0 and Y0.)
G21
G90
G1 X22.5 Y22.5 F1000
(PROBE id=1 name=plate_top nominal=22.5,22.5,0 normal=0,0,1 tol=0.05,0.05 frame=work)
G38.2 Z-25 F100
G4 P0.4
G91
G1 Z5 F1000
G90
G1 X-20 Y10 F1000
G91
G1 Z-11 F1000
G90
(PROBE id=2 name=plate_west_face nominal=0,10,-6 normal=-1,0,0 tol=0.05,0.05 frame=work)
G38.2 X25 F100
G4 P0.4
G91
G1 X-2 F1000
G1 Z11 F1000
G90
G1 X15 Y-20 F1000
G91
G1 Z-11 F1000
(PROBE id=3 name=plate_south_face nominal=15,0,-6 normal=0,-1,0 tol=0.05,0.05 frame=work)
G38.2 Y25 F100
G90
G4 P0.4
G91
G1 Y-2 F1000
G1 Z11 F1000
G90
G1 X0 Y0 F1000
M30
