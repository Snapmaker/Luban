(DERIVED FILE - written by the research agent 2026-09-07, not by Sienci Labs.)
(Source: gSender src/app/src/lib/Probing.ts, the "AZ Probe XYZ Auto" branch,)
(  GPL-3.0, https://github.com/Sienci-Labs/gsender - retrieved 2026-09-07.)
(Transformation: the %VAR assignments, the [EXPR] substitutions and the two)
(  "G10 L20" work-offset lines were removed; PROBE_DELAY was resolved to 0.15 s)
(  and the two X/Y centring moves that upstream computes at run time were)
(  replaced by explicit 0-length placeholders - see the notes below. zDistance)
(  25 mm is upstream's default with homing disabled. Every G38.2 target and)
(  every G0 hop below is upstream's literal number.)
(Geometry: the Sienci AutoZero touch plate - the routine drops to the plate top,)
(  then walks 13 mm off each side and probes inwards/outwards twice per axis.)
(Exercises: G91 relative probing throughout, coarse+fine two-pass probes,)
(  G4 dwells, 10 probe cycles, and the "centre from two opposed contacts" idiom.)
(WARNING: the X_CENTER / Y_CENTER moves upstream computes from the probe results)
(  are here written as comments only, so the run ends off-centre. This file is a)
(  PARSER fixture, not a machine program.)
G21
G91
G38.2 Z-25 F200
G0 Z2
G38.2 Z-5 F75
G4 P0.15
G0 Z3
G0 X-13
G38.2 X-30 F150
G0 X2
G38.2 X-5 F75
G4 P0.15
(X_LEFT recorded here)
G0 X26
G38.2 X30 F150
G0 X-2
G38.2 X5 F75
G4 P0.15
(X_RIGHT recorded here; upstream now moves G0 X[X_CENTER])
G0 Y-13
G38.2 Y-30 F250
G0 Y2
G38.2 Y-5 F75
G4 P0.15
(Y_BOTTOM recorded here)
G0 Y26
G38.2 Y30 F250
G0 Y-2
G38.2 Y5 F75
G4 P0.15
(Y_TOP recorded here; upstream now moves G0 Y[Y_CENTER] and zeroes the WCS)
G90
G0 Z10
M30
