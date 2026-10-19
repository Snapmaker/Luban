(DERIVED FILE - written by the research agent 2026-09-07, not by the UGS project.)
(Source: transcribed from the trailing "// G21 G91 G49; G38.2 ..." comments that)
(  UGS's own performHoleCenterProbeInternal carries next to each emitted command:)
(  ugs-platform/ProbeModule/.../probe/ProbeService.java, GPL-3.0,)
(  https://github.com/winder/Universal-G-Code-Sender - retrieved 2026-09-07.)
(  Upstream states the comments are "with radius 25 and retract 2, G21, G54",)
(  i.e. a 50 mm bore, 2 mm retract, mm mode.)
(Transformation: the two "G10 L20 P0 X0 Y0" WCS resets were dropped [our parser)
(  refuses G10], and the two G53 recentring moves - whose numbers upstream)
(  computes from the probe results, shown as X-336.29 / Y-322.116 - are kept)
(  verbatim so the G53 machine-frame path gets exercised. Start the run with the)
(  probe hanging inside the bore, below its top face.)
(Exercises: inside-circle 4-point bore probing, coarse+fine passes, G91 relative)
(  probes mixed with G90 absolute and G53 machine-frame links, G49. 8 cycles.)
G21
G49
G91
G38.2 X-25.0 F250
G0 X2.0
G38.2 X-25.0 F50
G90
G0 X0.0
G91
G38.2 X25.0 F250
G0 X-2.0
G38.2 X25.0 F50
G53 G0 X-336.29
G91
G38.2 Y-25.0 F250
G0 Y2.0
G38.2 Y-25.0 F50
G90
G0 Y0.0
G91
G38.2 Y25.0 F250
G0 Y-2.0
G38.2 Y25.0 F50
G53 G0 Y-322.116
M30
