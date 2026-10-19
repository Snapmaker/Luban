# Live generator controller fixtures

Captured from https://www.machiningdoctor.com/calculators/thread-milling-gcode-generator/
on 2026-09-26 through its form controls and calculation trigger. These are generated
NC outputs with comments removed, not copied generator implementation code. All use the same default
M1, 0.25 mm pitch, 1 mm length, 0.5 mm single-tooth cutter, internal RH climb setup.
Only the controller dropdown changed. Compare paths after conversion.

The live dropdown repeats the Siemens C-Type label; value `sd` actually produces a
Siemens D-Type header. The Mori Seiki selection emits a blank controller name in
its comment. The fixture names retain the selected dropdown values; comments are omitted
from the executable snapshots. No program in this directory has been run on a machine.

The adjacent `thread-milling-live-options.json` contains 24 live machining
combinations plus ten option cases, requested through the same public
`SERVER_SIDE("threadmill_cnc", JSON.stringify(input))` function called by the form.
Comments are stripped, executable lines are unchanged. Base inputs: metric M4,
major 4.05, minor 3.22, pitch 0.7, length 5, cutter diameter 2, effective length
2.1 for the short multi-tooth case; 60%/100% radial passes; X12.3/Y8.7/Z0 datum;
clearance Z20 and radial 0.3; tool 2, D3/H4, precision 4, 3 flutes, Vc50/Fz0.01.
The option cases cover precision 1–5, five 20%-spaced passes with one flute, ten
flutes with X22/Y-12/Z7 and clearance 10, and independent metric/inch input/output
units. The offset case uses program 7899, tool 7, D8/H9. Source RPM 7958 is below
the 200 W firmware minimum, so these geometry tests use explicit power mode;
this is a software test, not a recommended cutting setup.

Expected circle counts and Z endpoints are pinned independently. In particular,
single-tooth descending paths include eight 0.7 mm turns, which extend beyond the
nominal 5 mm length; inch output initially rounds clearance to 0.8 inch. The
converter preserves these source behaviors instead of correcting them silently.
