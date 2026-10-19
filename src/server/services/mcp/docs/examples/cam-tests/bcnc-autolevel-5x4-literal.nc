(DERIVED FILE - written by the research agent 2026-09-07, not by the bCNC project.)
(Generator: a faithful re-implementation of bCNC's own Probe.scan[] from)
(  bCNC/CNC.py [GPL-2.0, https://github.com/vlachoudis/bCNC, retrieved 2026-09-07],)
(  run with xmin/xmax/xn = 0/40/5, ymin/ymax/yn = 0/30/4, zmax/zmin = 2/-3,)
(  safe Z 10, probe feed 60. bCNC's boustrophedon [serpentine] row order and its)
(  4-decimal formatting are reproduced exactly.)
(Transformation for our parser: bCNC's "%wait" pseudo-commands are commented out)
(  below - they are a sender directive, not gcode. Everything else is verbatim)
(  bCNC output.)
(Exercises: a 5 x 4 = 20 point autolevel/flatness grid in the work frame, the)
(  same shape as our probe_surface_grid. G21 is NOT emitted by bCNC - the file)
(  relies on the sender's mm default, so it also tests our "motion before any)
(  G90/G91" warning path and our mm assumption.)
G90
G21
G0Z10.0000
G0X0.0000Y0.0000
G0Z2.0000
G0X0.0000Y0.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X10.0000Y0.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X20.0000Y0.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X30.0000Y0.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X40.0000Y0.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X40.0000Y10.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X30.0000Y10.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X20.0000Y10.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X10.0000Y10.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X0.0000Y10.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X0.0000Y20.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X10.0000Y20.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X20.0000Y20.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X30.0000Y20.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X40.0000Y20.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X40.0000Y30.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X30.0000Y30.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X20.0000Y30.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X10.0000Y30.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X0.0000Y30.0000
(%wait)
G38.2Z-3.0000F60
(%wait)
G0Z2.0000
G0X0.0000Y0.0000
M30
