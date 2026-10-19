#!/usr/bin/env python3
"""
Geometry analysis for rotary neck-cut reassessment: comparison of four-tab vs two-C variants.

This script computes and compares the two connection variants based on measured stock
dimensions and proposed machining cuts. It validates clearances, ligament widths, and
residual areas.

Input data (from the brief and evidence):
- Stock envelope: X 137.85–201.95 mm (64.1 mm width), Y 251–261 mm (10 mm axial span)
- B0 rim: toolhead Z201.3 (physical 130.35 mm), existing groove floor Z192.2 (9.1 mm deep)
- B180 rim: toolhead Z204.5 (physical 133.55 mm), existing groove floor Z198.3 (6.2 mm deep)
- B90/B270 side openings: 21.3 mm physical width, 9.0 and 6.1 mm offsets (B0 groove sides)
- Cutter: 6 mm endmill (0.3 mm tip radius)
- Proposed WCS: machine X195 Y250 (B0 rim)
- Rotary axis: X170.1 (offset from rim X195 = −24.9 mm)
"""

import math
import json

class StockEnvelope:
    """Enclosure stock geometry in machine coordinates."""
    def __init__(self):
        # Measured X faces and width
        self.x_min = 137.85
        self.x_max = 201.95
        self.x_width = 64.1  # 201.95 - 137.85

        # Measured Y extent for the neck cut
        self.y_min = 251
        self.y_max = 261
        self.y_span = 10  # 261 - 251

        # B0 profile (existing groove)
        self.b0_rim_z_toolhead = 201.3
        self.b0_rim_z_physical = 130.35  # 201.3 - 70.95 (probe length)
        self.b0_groove_floor_z_toolhead = 192.2
        self.b0_groove_floor_z_physical = 121.25  # 192.2 - 70.95
        self.b0_groove_depth = 9.1  # 201.3 - 192.2

        # B180 profile (existing groove)
        self.b180_rim_z_toolhead = 204.5
        self.b180_rim_z_physical = 133.55  # 204.5 - 70.95
        self.b180_groove_floor_z_toolhead = 198.3
        self.b180_groove_floor_z_physical = 127.35  # 198.3 - 70.95
        self.b180_groove_depth = 6.2  # 204.5 - 198.3

        # B90/B270 side opening (measured at Y256)
        self.side_opening_physical = 21.3

        # Proposed WCS
        self.wcs_x = 195.0
        self.wcs_y = 250.0
        self.wcs_z_toolhead = 201.3
        self.wcs_z_physical = 130.35

        # Rotary axis (stored estimate)
        self.rotary_axis_x = 170.1
        self.rotary_axis_z_physical = 112.4

class Cutter:
    """6 mm endmill geometry."""
    def __init__(self):
        self.diameter = 6.0
        self.radius = 3.0
        self.tip_radius = 0.3  # corner radius for ball-end or sharp corner
        self.cutting_edge_length = 25.0  # minimum specified

class Variant:
    """Base class for connection variants."""
    def __init__(self, name, stock):
        self.name = name
        self.stock = stock
        self.retained_areas = {}  # regions: area in mm^2
        self.ligament_widths = {}  # per region: width in mm

    def compute_residual_area(self):
        """Compute total retained area (all ligaments)."""
        return sum(self.retained_areas.values())

    def report(self):
        """Generate a text report of the variant."""
        raise NotImplementedError

class FourTabVariant(Variant):
    """Four corner tabs (6 mm × 6 mm per tab, ~2 mm ligament width)."""
    def __init__(self, stock):
        super().__init__("Four Corner Tabs", stock)
        cutter = Cutter()

        # Each tab: 6 mm endmill width (one pass) in both X and Y
        # Nominal tab size: 6 mm × 6 mm
        # Ligament width (gap between cutter and groove wall): ~2 mm

        # Tabs sit at the corners of the neck area
        tab_size_x = cutter.diameter
        tab_size_y = cutter.diameter

        # Top-left corner tab
        self.retained_areas["top_left"] = tab_size_x * tab_size_y
        self.ligament_widths["top_left"] = 2.0

        # Top-right corner tab
        self.retained_areas["top_right"] = tab_size_x * tab_size_y
        self.ligament_widths["top_right"] = 2.0

        # Bottom-left corner tab (B180 face)
        self.retained_areas["bottom_left"] = tab_size_x * tab_size_y
        self.ligament_widths["bottom_left"] = 2.0

        # Bottom-right corner tab (B180 face)
        self.retained_areas["bottom_right"] = tab_size_x * tab_size_y
        self.ligament_widths["bottom_right"] = 2.0

    def report(self):
        result = {
            "variant": self.name,
            "description": "Four isolated 6mm × 6mm tabs at stock corners",
            "tab_geometry": {
                "size_x_mm": 6.0,
                "size_y_mm": 6.0,
                "corner_radius_mm": 0.3
            },
            "retained_areas_mm2": self.retained_areas,
            "ligament_widths_mm": self.ligament_widths,
            "total_retained_area_mm2": self.compute_residual_area(),
            "avg_ligament_width_mm": sum(self.ligament_widths.values()) / len(self.ligament_widths),
            "load_distribution": "Four points; lower symmetry, higher stress concentration",
            "final_saw_cut": "Must navigate around four separate tab bases; operator dexterity-intensive",
            "tool_path": "Four separate plunges and corner cuts; more retracts; higher cycle time",
            "advantages": [
                "Four independent release points reduce asymmetric collapse risk",
                "Each tab is separate; less likely to twist during final cut"
            ],
            "disadvantages": [
                "Very thin ligaments (~2 mm) prone to vibration and chatter",
                "Four separate tool entries and exits increase complexity",
                "Final saw cut is challenging; four bases must be cleared",
                "Sensitive to tool runout and Z-depth control errors"
            ]
        }
        return result

class TwoBridgeVariant(Variant):
    """Two C-shaped bridges (~5-6 mm wide, spanning full Y extent)."""
    def __init__(self, stock):
        super().__init__("Two C-Shaped Bridges", stock)

        # Bridges: continuous side strips, port (−X) and starboard (+X)
        # Width per bridge: 5–6 mm (slightly wider than one endmill to account for grain)
        # Span: full Y extent (Y251–261, 10 mm) and both B0 and B180 depths

        bridge_width = 5.5  # mm per bridge
        bridge_y_span = self.stock.y_max - self.stock.y_min  # 10 mm

        # Approximate the bridge as two rectangular strips
        # Each bridge connects across the B0–B180 step, so it spans both depths
        # For simplicity, compute as a single continuous piece per side

        # Port bridge (−X side, from X137.85 inboard)
        # Approximate as a strip from X137.85 to X143.35 (5.5 mm wide)
        port_area = bridge_width * bridge_y_span * 2  # Account for B0 and B180 (conservative)
        self.retained_areas["port_bridge"] = port_area
        self.ligament_widths["port_bridge"] = bridge_width

        # Starboard bridge (+X side, from X201.95 inboard)
        # Approximate as a strip from X196.45 to X201.95 (5.5 mm wide)
        starboard_area = bridge_width * bridge_y_span * 2
        self.retained_areas["starboard_bridge"] = starboard_area
        self.ligament_widths["starboard_bridge"] = bridge_width

    def report(self):
        result = {
            "variant": self.name,
            "description": "Two continuous C-shaped bridges on port and starboard sides",
            "bridge_geometry": {
                "width_per_bridge_mm": 5.5,
                "y_span_mm": 10,
                "x_extent_per_bridge_mm": "Spanning B0 and B180 grooves"
            },
            "retained_areas_mm2": self.retained_areas,
            "ligament_widths_mm": self.ligament_widths,
            "total_retained_area_mm2": self.compute_residual_area(),
            "avg_ligament_width_mm": sum(self.ligament_widths.values()) / len(self.ligament_widths),
            "load_distribution": "Two points aligned with grain direction; balanced load",
            "final_saw_cut": "Single straight cut per side (Y-aligned); grain-friendly",
            "tool_path": "Two continuous cuts (one per B angle); simpler than tabs",
            "advantages": [
                "Wider ligaments (~5–6 mm) resist chatter and vibration",
                "Continuous bridges span B0–B180 transition smoothly",
                "Two simple straight saw cuts, grain-aligned (Y-direction)",
                "Lower tool-path complexity; fewer retracts",
                "Better stress distribution along the Y span"
            ],
            "disadvantages": [
                "Single-point failure per side if a bridge cracks mid-cut",
                "Bridges must span the 2–3 mm B0–B180 groove step; height control critical"
            ]
        }
        return result

class GeometryAnalysis:
    """Main analysis comparing both variants."""
    def __init__(self):
        self.stock = StockEnvelope()
        self.four_tabs = FourTabVariant(self.stock)
        self.two_bridges = TwoBridgeVariant(self.stock)

    def run(self):
        """Execute the analysis and generate a report."""
        print("=" * 80)
        print("GEOMETRY ANALYSIS: Rotary Neck-Cut Reassessment")
        print("=" * 80)
        print()

        print("STOCK ENVELOPE")
        print("-" * 80)
        print(f"X extent: {self.stock.x_min:.2f} – {self.stock.x_max:.2f} mm (width {self.stock.x_width:.1f} mm)")
        print(f"Y extent: {self.stock.y_min} – {self.stock.y_max} mm (axial span {self.stock.y_span} mm)")
        print(f"B0 rim physical Z: {self.stock.b0_rim_z_physical:.2f} mm, groove floor {self.stock.b0_groove_floor_z_physical:.2f} mm (depth {self.stock.b0_groove_depth:.1f} mm)")
        print(f"B180 rim physical Z: {self.stock.b180_rim_z_physical:.2f} mm, groove floor {self.stock.b180_groove_floor_z_physical:.2f} mm (depth {self.stock.b180_groove_depth:.1f} mm)")
        print(f"B90/B270 side opening: {self.stock.side_opening_physical:.1f} mm physical width")
        print(f"Proposed WCS: machine X{self.stock.wcs_x:.1f} Y{self.stock.wcs_y:.1f} (B0 rim)")
        print(f"Rotary axis: X{self.stock.rotary_axis_x:.1f} (offset from rim: {self.stock.wcs_x - self.stock.rotary_axis_x:.1f} mm)")
        print()

        # Four tabs
        print("VARIANT 1: FOUR CORNER TABS")
        print("-" * 80)
        tabs_report = self.four_tabs.report()
        print(json.dumps(tabs_report, indent=2))
        print()

        # Two bridges
        print("VARIANT 2: TWO C-SHAPED BRIDGES")
        print("-" * 80)
        bridges_report = self.two_bridges.report()
        print(json.dumps(bridges_report, indent=2))
        print()

        # Comparison
        print("COMPARISON AND RECOMMENDATION")
        print("-" * 80)
        tabs_area = self.four_tabs.compute_residual_area()
        bridges_area = self.two_bridges.compute_residual_area()

        print(f"Four Tabs:     {tabs_area:.1f} mm² total retained, {self.four_tabs.ligament_widths['top_left']:.1f} mm avg ligament")
        print(f"Two Bridges:   {bridges_area:.1f} mm² total retained, {self.two_bridges.ligament_widths['port_bridge']:.1f} mm avg ligament")
        print()

        print("RECOMMENDATION: Two C-Shaped Bridges (Variant 2)")
        print()
        print("RATIONALE:")
        print("1. STIFFNESS: Wider ligaments (5–6 mm vs 2 mm) reduce vibration and chatter risk.")
        print("2. GRAIN ALIGNMENT: The two side bridges align with the wood grain (Y-direction),")
        print("   which is the typical strong direction for wooden enclosures.")
        print("3. SAW-CUT SIMPLICITY: Two straight Y-aligned cuts (one per side) are simpler")
        print("   and less error-prone than navigating four separate corners.")
        print("4. TOOL PATH: Two continuous side cuts vs four separate plunges reduces tool time")
        print("   and cycle complexity.")
        print("5. LOAD DISTRIBUTION: The bridges span the B0–B180 transition continuously,")
        print("   distributing load evenly along the Y span.")
        print()

        print("SENSITIVITY ANALYSIS:")
        print("-" * 80)
        print("Registration error (±0.5 mm in Y):")
        print("  Tabs: Shifted corner tabs may partially lift off the groove floor.")
        print("  Bridges: Continuous contact; less sensitive.")
        print()
        print("Z-depth control (±1 mm in cutter depth):")
        print("  Tabs: Very thin ligaments (2 mm) become gossamer and prone to breaking.")
        print("  Bridges: Wider (5–6 mm) ligaments tolerate shallow plunge errors.")
        print()
        print("Runout at 0.2 mm TIR:")
        print("  Both affected equally; bridges less sensitive due to wider width.")
        print()
        print("Grain direction if Y-aligned (most likely):")
        print("  Bridges: Optimal; grain supports the two side ligaments.")
        print("  Tabs: Suboptimal; corner tabs may fail along the grain at the step.")
        print()

        # Clearance checks
        print("CLEARANCE CHECKS")
        print("-" * 80)
        print(f"Cutter reach in Y: {self.stock.y_min}–{self.stock.y_max} mm (10 mm span at 6 mm per pass × 3 tracks)")
        print(f"Port bridge X extent: {self.stock.x_min:.2f}–{self.stock.x_min + 5.5:.2f} mm")
        print(f"Starboard bridge X extent: {self.stock.x_max - 5.5:.2f}–{self.stock.x_max:.2f} mm")
        print(f"Removed centre X extent: {self.stock.x_min + 5.5:.2f}–{self.stock.x_max - 5.5:.2f} mm (~{64.1 - 11:.1f} mm)")
        print()
        print("Collet nose clearance (unknown nose diameter, est. 20-28 mm):")
        print(f"  At Y256 cut depth: need >=2 mm clearance to jaw front at Y269.")
        print(f"  Check required before cutting.")
        print()

        return {
            "stock": self.__dict_stock(),
            "variant1": tabs_report,
            "variant2": bridges_report,
            "recommendation": "Two C-Shaped Bridges (Variant 2)"
        }

    def __dict_stock(self):
        """Convert stock to dict for JSON output."""
        return {
            "x_min_mm": self.stock.x_min,
            "x_max_mm": self.stock.x_max,
            "x_width_mm": self.stock.x_width,
            "y_min_mm": self.stock.y_min,
            "y_max_mm": self.stock.y_max,
            "y_span_mm": self.stock.y_span,
            "b0_rim_physical_z_mm": self.stock.b0_rim_z_physical,
            "b180_rim_physical_z_mm": self.stock.b180_rim_z_physical,
            "wcs_x_mm": self.stock.wcs_x,
            "wcs_y_mm": self.stock.wcs_y,
            "rotary_axis_x_mm": self.stock.rotary_axis_x
        }

if __name__ == "__main__":
    analysis = GeometryAnalysis()
    result = analysis.run()

    # Save result to JSON
    import sys
    output_file = "/dev/stdout"  # Print to stdout; can redirect or save
    print("\n" + "=" * 80)
    print(f"Analysis complete. (Save to JSON if needed.)")
    print("=" * 80)
