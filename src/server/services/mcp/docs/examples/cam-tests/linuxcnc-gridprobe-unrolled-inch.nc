(DERIVED FILE - written by the research agent 2026-09-07, not by LinuxCNC.)
(Source: LinuxCNC nc_files/gridprobe.ngc, GPL-2.0,)
(  https://github.com/LinuxCNC/linuxcnc - retrieved 2026-09-07.)
(Transformation: the O-word while loops and #1..#10 parameters were unrolled with)
(  the file's own shipped configuration values - X start 0 step .25 count 13,)
(  Y start 0 step .25 count 5, Z safety .1, Z probe -.5, probe feed 4 - so that)
(  the program contains literal numbers only. The serpentine row reversal that)
(  gridprobe.ngc's O3 if/else implements is reproduced. [PROBEOPEN ...] is left)
(  as an ordinary comment.)
(Exercises: G20 INCHES - this is the file to use to test our inch-to-mm)
(  conversion and its warning - plus a 13 x 5 = 65 point Z grid, 65 probe cycles.)
G90
G20
(PROBEOPEN probe-results.txt)
G0 Z0.1
G0 Y0
G0 X0
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X3
G38.2 Z-0.5 F4
G0 Z0.1
G0 Y0.25
G0 X3
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0
G38.2 Z-0.5 F4
G0 Z0.1
G0 Y0.5
G0 X0
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X3
G38.2 Z-0.5 F4
G0 Z0.1
G0 Y0.75
G0 X3
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0
G38.2 Z-0.5 F4
G0 Z0.1
G0 Y1
G0 X0
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X0.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X1.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.25
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.5
G38.2 Z-0.5 F4
G0 Z0.1
G0 X2.75
G38.2 Z-0.5 F4
G0 Z0.1
G0 X3
G38.2 Z-0.5 F4
G0 Z0.1
(PROBECLOSE)
G0 Z0.1
G0 X0 Y0
M2
