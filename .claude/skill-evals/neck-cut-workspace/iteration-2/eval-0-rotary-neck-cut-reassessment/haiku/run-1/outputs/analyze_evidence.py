#!/usr/bin/env python3
"""
Analyze the measured probe evidence for the rotary neck-cut reassessment.
Build a ledger of evidence and derived values.
"""

import json
import math

# Probe calibration
PROBE_EFFECTIVE_LENGTH_MM = 70.95
PROBE_TIP_EXPOSED_MM = 21
PROBE_TIP_RADIUS_MM = 1.25

# Stock dimensions from evidence
B0_X_FACE_OUTER = 137.85  # mm, machine coords
B0_X_FACE_INNER = 201.95  # mm
B0_WIDTH = B0_X_FACE_INNER - B0_X_FACE_OUTER  # 64.1 mm
B0_SIDE_SILHOUETTE = 36.4  # mm at Y245

# Key measurements in machine toolhead Z (all B0 unless noted)
B0_RIM_TOOLHEAD_Z = 201.3  # At X195, Y250
B0_RIM_PHYSICAL_Z = B0_RIM_TOOLHEAD_Z - PROBE_EFFECTIVE_LENGTH_MM  # 130.35
B0_GROOVE_FLOOR_TOOLHEAD_Z = 192.2  # Y254-259
B0_GROOVE_FLOOR_PHYSICAL_Z = B0_GROOVE_FLOOR_TOOLHEAD_Z - PROBE_EFFECTIVE_LENGTH_MM  # 121.25
B0_GROOVE_DEPTH = B0_RIM_PHYSICAL_Z - B0_GROOVE_FLOOR_PHYSICAL_Z  # 9.1 mm

B180_RIM_TOOLHEAD_Z = 204.5
B180_RIM_PHYSICAL_Z = B180_RIM_TOOLHEAD_Z - PROBE_EFFECTIVE_LENGTH_MM  # 133.55
B180_GROOVE_FLOOR_TOOLHEAD_Z = 198.3
B180_GROOVE_FLOOR_PHYSICAL_Z = B180_GROOVE_FLOOR_TOOLHEAD_Z - PROBE_EFFECTIVE_LENGTH_MM  # 127.35
B180_GROOVE_DEPTH = B180_RIM_PHYSICAL_Z - B180_GROOVE_FLOOR_PHYSICAL_Z  # 6.2 mm

# Side opening measurements
SIDE_OPENING_PHYSICAL_AT_Y256 = 21.3  # mm

# Raised boundary (B0, X195, Y270-278)
RAISED_SURFACE_TOOLHEAD_Z_LOW = 206.4  # Y270.5
RAISED_SURFACE_TOOLHEAD_Z_HIGH = 214.3  # Y272-278
RAISED_SURFACE_PHYSICAL_Z_LOW = RAISED_SURFACE_TOOLHEAD_Z_LOW - PROBE_EFFECTIVE_LENGTH_MM  # 135.45
RAISED_SURFACE_PHYSICAL_Z_HIGH = RAISED_SURFACE_TOOLHEAD_Z_HIGH - PROBE_EFFECTIVE_LENGTH_MM  # 143.35

# Step location
STEP_BETWEEN_Y = (270.5, 271.0)

# Proposed WCS (not yet set on controller)
PROPOSED_WCS_MACHINE_X = 230.0
PROPOSED_WCS_MACHINE_Y = 245.0
PROPOSED_WCS_PROBE_TOOLHEAD_Z = 231.3
PROPOSED_WCS_PHYSICAL_Z = 160.35

# Live G54 on 27 September (OLD, NOT the proposed WCS)
LIVE_G54_MACHINE_X = 169.953
LIVE_G54_MACHINE_Y = 133.632
LIVE_G54_TOOLHEAD_Z = 208.5
LIVE_G54_PHYSICAL_Z = LIVE_G54_TOOLHEAD_Z - PROBE_EFFECTIVE_LENGTH_MM

# Tool specifications
ENDMILL_DIAMETER = 6.0  # mm
ENDMILL_CUTTING_EDGE_LENGTH = 25.0  # mm
ENDMILL_OVERALL_LENGTH = 75.0  # mm
ENDMILL_ESTIMATED_PROTRUSION = 55.0  # mm in collet

# Rotary axis (estimates, not safe toolhead Z targets)
ROTARY_AXIS_MACHINE_X = 170.1
ROTARY_AXIS_PHYSICAL_Z = 112.4

# Enclosure nominal dimensions (from reference CAD)
ENCLOSURE_X_OUTSIDE = 64.0  # mm
ENCLOSURE_Z_OUTSIDE = 36.0  # mm
ENCLOSURE_Y_EXTENT = 119.0  # mm

# Jaw/fixture exclusion zone
JAW_FRONT_APPROX_Y = 269.0

def analyze_evidence():
    print("=" * 80)
    print("NECK-CUT REASSESSMENT EVIDENCE ANALYSIS")
    print("=" * 80)
    print()

    print("COORDINATE FRAME CONSTANTS")
    print("-" * 80)
    print(f"Probe effective length:        {PROBE_EFFECTIVE_LENGTH_MM} mm")
    print(f"Probe tip exposed:             {PROBE_TIP_EXPOSED_MM} mm")
    print(f"Probe tip radius:              {PROBE_TIP_RADIUS_MM} mm")
    print()

    print("B0 MEASUREMENTS (X = {})".format(195))
    print("-" * 80)
    print(f"Outside faces at Y245:         X {B0_X_FACE_OUTER} to {B0_X_FACE_INNER} (width {B0_WIDTH} mm)")
    print(f"Side silhouette at Y245:       {B0_SIDE_SILHOUETTE} mm")
    print()
    print(f"Top rim contact:")
    print(f"  Toolhead Z:                  {B0_RIM_TOOLHEAD_Z} mm")
    print(f"  Physical Z (tip):            {B0_RIM_PHYSICAL_Z} mm")
    print()
    print(f"Existing groove floor (Y254-259):")
    print(f"  Toolhead Z:                  {B0_GROOVE_FLOOR_TOOLHEAD_Z} mm")
    print(f"  Physical Z:                  {B0_GROOVE_FLOOR_PHYSICAL_Z} mm")
    print(f"  Depth below rim:             {B0_GROOVE_DEPTH} mm")
    print()

    print("B180 MEASUREMENTS (X = {})".format(198))
    print("-" * 80)
    print(f"Top rim contact (Y245-253):")
    print(f"  Toolhead Z:                  {B180_RIM_TOOLHEAD_Z} mm")
    print(f"  Physical Z:                  {B180_RIM_PHYSICAL_Z} mm")
    print()
    print(f"Groove floor (Y254-258):")
    print(f"  Toolhead Z:                  {B180_GROOVE_FLOOR_TOOLHEAD_Z} mm")
    print(f"  Physical Z:                  {B180_GROOVE_FLOOR_PHYSICAL_Z} mm")
    print(f"  Depth below rim:             {B180_GROOVE_DEPTH} mm")
    print()

    print("SIDE OPENING (B90/B270)")
    print("-" * 80)
    print(f"Physical opening at Y256:      {SIDE_OPENING_PHYSICAL_AT_Y256} mm")
    print()

    print("RAISED SURFACE / CHUCK TRANSITION (B0, X195, Y270-278)")
    print("-" * 80)
    print(f"Low point (Y270.5):")
    print(f"  Toolhead Z:                  {RAISED_SURFACE_TOOLHEAD_Z_LOW} mm")
    print(f"  Physical Z:                  {RAISED_SURFACE_PHYSICAL_Z_LOW} mm")
    print()
    print(f"High plateau (Y272-278):")
    print(f"  Toolhead Z:                  {RAISED_SURFACE_TOOLHEAD_Z_HIGH} mm")
    print(f"  Physical Z:                  {RAISED_SURFACE_PHYSICAL_Z_HIGH} mm")
    print()
    print(f"Step location: between Y{STEP_BETWEEN_Y[0]} and Y{STEP_BETWEEN_Y[1]}")
    print(f"Step height: ~{RAISED_SURFACE_PHYSICAL_Z_HIGH - RAISED_SURFACE_PHYSICAL_Z_LOW:.1f} mm")
    print()

    print("PROPOSED WORK ORIGIN (NOT YET SET ON CONTROLLER)")
    print("-" * 80)
    print(f"Machine position:              X{PROPOSED_WCS_MACHINE_X} Y{PROPOSED_WCS_MACHINE_Y}")
    print(f"Probe toolhead Z:              {PROPOSED_WCS_PROBE_TOOLHEAD_Z} mm")
    print(f"Physical probe tip Z:          {PROPOSED_WCS_PHYSICAL_Z} mm")
    print(f"Clearance above B0 rim:        {PROPOSED_WCS_PHYSICAL_Z - B0_RIM_PHYSICAL_Z} mm")
    print()

    print("LIVE G54 OFFSET (27 SEPTEMBER - OLD, NOT THE PROPOSED WCS)")
    print("-" * 80)
    print(f"Machine G54 origin:            X{LIVE_G54_MACHINE_X:.3f} Y{LIVE_G54_MACHINE_Y:.3f} toolhead Z{LIVE_G54_TOOLHEAD_Z}")
    print(f"Physical tip Z:                {LIVE_G54_PHYSICAL_Z:.2f} mm")
    print()

    print("CUTTING TOOL SPECIFICATION (6mm ENDMILL)")
    print("-" * 80)
    print(f"Diameter:                      {ENDMILL_DIAMETER} mm")
    print(f"Cutting edge length:           {ENDMILL_CUTTING_EDGE_LENGTH} mm")
    print(f"Overall length:                {ENDMILL_OVERALL_LENGTH} mm")
    print(f"Est. protrusion in collet:     {ENDMILL_ESTIMATED_PROTRUSION} mm")
    print(f"Collet diameter:               UNKNOWN - needs measurement")
    print()

    print("ROTARY AXIS (ESTIMATES - NOT SAFE TOOLHEAD TARGETS)")
    print("-" * 80)
    print(f"Machine X:                     {ROTARY_AXIS_MACHINE_X} mm (estimate, tied to 2026-09-05, 71.3mm probe)")
    print(f"Physical Z:                    {ROTARY_AXIS_PHYSICAL_Z} mm (estimate)")
    print()

    print("ENCLOSURE CAD NOMINAL DIMENSIONS")
    print("-" * 80)
    print(f"Outside cross-section:         {ENCLOSURE_X_OUTSIDE} × {ENCLOSURE_Z_OUTSIDE} mm")
    print(f"Y extent:                      {ENCLOSURE_Y_EXTENT} mm (0-119 in CAD coords)")
    print(f"Status:                        NOT YET REGISTERED to machine coordinates")
    print()

    print("FIXTURE / CHUCK CONSTRAINTS")
    print("-" * 80)
    print(f"Jaw front approx. Y:           {JAW_FRONT_APPROX_Y} (uncertain, not remeasured)")
    print(f"Tool-jaw clearance margin:     5 mm (stated as established)")
    print()

    # Derived calculations
    print("=" * 80)
    print("DERIVED CALCULATIONS")
    print("=" * 80)
    print()

    print("STOCKMATERIAL THICKNESS")
    print("-" * 80)
    # B0 rim to groove floor depth
    print(f"B0 apparent section (Y254-259):")
    print(f"  Rim to floor depth:          {B0_GROOVE_DEPTH:.1f} mm")
    print()
    # B180 shows a different depth
    print(f"B180 apparent section (Y254-258):")
    print(f"  Rim to floor depth:          {B180_GROOVE_DEPTH:.1f} mm")
    print(f"  Difference from B0:          {B0_GROOVE_DEPTH - B180_GROOVE_DEPTH:.1f} mm")
    print("  Interpretation: Different groove depths at B0 vs B180 suggest")
    print("                  a hollow enclosure with varying wall thickness")
    print()

    print("SIDE OPENING vs TOP RIM")
    print("-" * 80)
    y_offset = 256 - 250
    print(f"B0 top rim to side opening Y:  {y_offset} mm (Y256 - Y250)")
    print(f"Opening depth at Y256:         {SIDE_OPENING_PHYSICAL_AT_Y256:.1f} mm")
    print(f"B0 rim width (X):              {B0_WIDTH:.1f} mm")
    print(f"Implied side wall thickness:   {(B0_WIDTH - SIDE_OPENING_PHYSICAL_AT_Y256) / 2:.1f} mm each side")
    print()

    print("PROBE REACH CONSTRAINTS")
    print("-" * 80)
    probe_reach_limit = PROBE_TIP_EXPOSED_MM - PROBE_TIP_RADIUS_MM - 2  # 2mm margin
    print(f"Stylus exposed:                {PROBE_TIP_EXPOSED_MM} mm")
    print(f"Tip radius:                    {PROBE_TIP_RADIUS_MM} mm")
    print(f"Safe descent margin:           2 mm")
    print(f"Maximum depth below rim:       {probe_reach_limit:.1f} mm")
    print()
    print(f"B0 groove depth ({B0_GROOVE_DEPTH:.1f} mm) vs probe reach ({probe_reach_limit:.1f} mm)")
    print(f"  Status: WITHIN REACH (margin {probe_reach_limit - B0_GROOVE_DEPTH:.1f} mm)")
    print()

    print("=" * 80)
    print("MEASUREMENT EVIDENCE LEDGER")
    print("=" * 80)
    print()

    evidence = [
        ("B0 outside X faces (Y245)", "137.85 / 201.95 mm", "machine X", "probed rim", "measured"),
        ("B0 side silhouette (Y245)", "36.4 mm", "physical cross-section", "profile probe", "measured"),
        ("B0 rim height (X195, Y250)", "130.35 mm physical Z", "physical Z surface", "probe job 7685888d887d", "measured"),
        ("B0 groove floor (Y254-259)", "121.25 mm physical Z", "physical Z surface", "probe job 7685888d887d", "measured"),
        ("B0 groove depth", "9.1 mm", "physical depth", "derived from measurements", "inferred"),
        ("B180 rim height (X198, Y250)", "133.55 mm physical Z", "physical Z surface", "probe job f8f12d4a4b3e", "measured"),
        ("B180 groove floor (Y254-258)", "127.35 mm physical Z", "physical Z surface", "probe job f8f12d4a4b3e", "measured"),
        ("B180 groove depth", "6.2 mm", "physical depth", "derived from measurements", "inferred"),
        ("Side opening (Y256)", "21.3 mm", "physical width", "probe job from README", "measured"),
        ("Raised surface base (Y270.5)", "135.45 mm physical Z", "physical Z surface", "probe job cc6e2592ccd6", "measured"),
        ("Raised surface plateau (Y272-278)", "143.35 mm physical Z", "physical Z surface", "probe job cc6e2592ccd6", "measured"),
        ("Proposed WCS origin", "X230, Y245, Z160.35 physical", "machine frame / physical", "job 4a426e131af8", "proposed not set"),
        ("Rotary axis X estimate", "170.1 mm machine X", "machine frame", "stored geometry 2026-09-05", "nominal CAD"),
        ("Rotary axis Z estimate", "112.4 mm physical Z", "physical Z surface", "stored geometry", "nominal CAD"),
        ("Enclosure nominal X", "64 mm", "CAD frame", "reference_enclosure_20260922.FCStd", "nominal CAD"),
        ("Enclosure nominal Z", "36 mm", "CAD frame", "reference_enclosure_20260922.FCStd", "nominal CAD"),
    ]

    print("| Feature | Value | Frame | Source | Status |")
    print("|---------|-------|-------|--------|--------|")
    for feature, value, frame, source, status in evidence:
        print(f"| {feature} | {value} | {frame} | {source} | {status} |")
    print()

if __name__ == "__main__":
    analyze_evidence()
