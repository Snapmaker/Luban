%
(Luban MCP run_probing_gcode sample - Grbl/Marlin dialect, WORK frame G54)
(Two cycles on the block outlined 2026-09-06: top at the centre, then the west face.)
(Numbers are WORK coordinates; the work origin must be live on the heartbeat when staging.)
(Adjust the clearance Z and the targets to the stock before use; keep cycle travel GENEROUS.)
(RESULTS documentid=sample modelversion=1 toolpathid=1.00001 toolpath=SAMPLE_TOP_AND_WEST)
N10 G90 G94 G17 G21
N20 G0 X0 Y0 Z10
(PROBE id=1 name=top_centre nominal=0,0,0 normal=0,0,1 tol=0.1,-0.1 offset=0)
N30 G38.2 Z-15 F100
N40 G0 Z10
N50 G0 X-40 Y0
N60 G0 Z-2
(PROBE id=2 name=west_face group=block role=x_minus nominal=-22.133,0,-2 normal=-1,0,0 tol=0.1,-0.1 offset=0)
N70 G38.2 X-5 F60
N80 G0 X-40
N90 G0 Z10
M30
%
