# -*- coding: utf-8 -*-
"""FreeCAD-side emitter of probing programs for the Luban MCP `run_probing_gcode` tool.

Why this exists (2026-09-21, docs/HANDOFF-probing-gcode-pipeline): FreeCAD's
``Path.Op.Probe`` operation carries no nominals, normals, tolerances or point
identity, so no post processor can emit the ``(PROBE ...)`` metadata the MCP
reports against; and the posted trajectory is discarded anyway (the runner
re-derives every march under the motion laws). What the MCP needs is INTENT:
where the surface should be, which way it faces, how far off is acceptable.
That lives in the CAD, so this script reads it straight off the faces and
writes a program in the dialect ``probeGcode.ts`` parses:

    (RESULTS documentid=.. modelversion=.. toolpathid=1.00001 toolpath=NAME)
    G90 G94 G17 G21
    G0 Z<safe>
    G0 X.. Y..
    G0 Z<approach>
    (PROBE id=1 name=top_c group=top role=z nominal=x,y,z normal=i,j,k tol=u,l offset=0 frame=work)
    G38.2 X.. Y.. Z.. F100
    G0 X.. Y.. Z..            ; back to the approach point
    ...
    M30

No M3/M4, M6, G28, G92, arcs or macro variables (all refused by the parser).
Feeds are for readability only; the MCP runs its own sensor-gated march.

Usage inside FreeCAD (Python console or a macro), against the open document::

    import freecad_probe_emitter as fpe
    spec = [
        {"object": "Clone", "face": "Face25", "name": "top", "group": "top", "role": "z",
         "grid": (3, 1), "inset": 8, "tol": (0.2, 0.2)},
        {"object": "Clone", "face": "Face24", "name": "east", "group": "outer", "role": "x_plus",
         "grid": (2, 1), "inset": 5, "depth": 3},
    ]
    fpe.emit_probe_program(App.ActiveDocument, spec, "C:/path/out.nc",
                           frame="work", clearance=10, overtravel=10)

Then stage it with ``run_probing_gcode {gcode, source, frame, reason}``. The
program's coordinates are the model's (job) frame unless ``placement`` maps
them somewhere else: pass the MEASURED model-to-machine placement (from the
alignment probe) and ``frame="machine"`` to emit machine coordinates - never
CAD coordinates alone for a re-clamped part.

Every number is the CAD nominal; a face is probed along its INWARD normal from
``clearance`` mm outside it to ``overtravel`` mm past it (the target is the
MCP's travel limit - keep it generous, a short cycle silently misses).

TIP CONVENTION (the one the MCP applies, issue #175): every ``nominal=`` here is
a SURFACE point on the CAD face. The MCP's recorded contact is the tip REFERENCE
point - stylus-centre X/Y, stylus-BOTTOM Z, because the probe's effective length
is measured on the tool setter to the tip bottom - and the surface it compares
with the nominal is ``contact + (0, 0, r) - r * normal`` (r = tip radius from
set_probe_geometry): no correction on a -Z (top) march, one radius on a side
march. Nothing in this file is a tip-centre coordinate. The emitted program
carries the same statement as a comment so the report can be read back alone.
``depth`` (side faces) pulls the sample points that far below the face's top
edge, ``inset`` keeps them that far from every edge, ``grid`` = (along, across)
sample counts, ``points`` = explicit (u, v) fractions instead of a grid.
"""

import datetime
import math
import os

import FreeCAD as App

TOLERANCE_DEFAULT = (0.2, 0.2)
# A grid sample further than this from the face is in a hole or past an edge (curved faces sit within it).
SNAP_MAX_MM = 0.5


def _r3(v):
    return ("%.3f" % v).rstrip("0").rstrip(".") if abs(v) >= 1e-9 else "0"


def _fmt_triple(v):
    return "%s,%s,%s" % (_r3(v.x), _r3(v.y), _r3(v.z))


def _face_of(doc, obj_name, face_name):
    obj = doc.getObject(obj_name)
    if obj is None:
        raise ValueError("no object %r in %s" % (obj_name, doc.Name))
    shape = obj.Shape
    if face_name.startswith("Face"):
        idx = int(face_name[4:]) - 1
        if idx < 0 or idx >= len(shape.Faces):
            raise ValueError("%s has %d faces, no %s" % (obj_name, len(shape.Faces), face_name))
        return shape.Faces[idx]
    raise ValueError("face must be 'FaceN' (1-based, as FreeCAD names it): %r" % face_name)


def _outward_normal(face, u, v):
    n = face.normalAt(u, v)
    if face.Orientation == "Reversed":
        n = n * -1
    n.normalize()
    return n


def _face_axes(face, n):
    """Two orthonormal in-plane axes: 'along' = the longest edge direction projected into the plane."""
    longest = max(face.Edges, key=lambda e: e.Length)
    a = longest.valueAt(longest.LastParameter) - longest.valueAt(longest.FirstParameter)
    a = a - n * a.dot(n)
    if a.Length < 1e-9:
        a = App.Vector(1, 0, 0) - n * n.x
    a.normalize()
    b = n.cross(a)
    b.normalize()
    return a, b


def _sample_points(face, sel):
    """Nominal points ON the face (global coordinates) with their outward normals."""
    u0, u1, v0, v1 = face.ParameterRange
    um, vm = (u0 + u1) / 2, (v0 + v1) / 2
    n = _outward_normal(face, um, vm)
    a, b = _face_axes(face, n)
    centre = face.CenterOfMass
    inset = float(sel.get("inset", 5.0))
    # Extent of the face along a and b, from its vertices.
    verts = [vt.Point for vt in face.Vertexes]
    ea = [(p - centre).dot(a) for p in verts]
    eb = [(p - centre).dot(b) for p in verts]
    a_min, a_max = min(ea) + inset, max(ea) - inset
    b_min, b_max = min(eb) + inset, max(eb) - inset
    if a_min > a_max or b_min > b_max:
        raise ValueError("inset %.1f leaves no room on face (extent %.1f x %.1f)" % (inset, max(ea) - min(ea), max(eb) - min(eb)))
    fractions = sel.get("points")
    if not fractions:
        na, nb = sel.get("grid", (1, 1))
        fractions = [((i + 0.5) / na, (j + 0.5) / nb) for j in range(nb) for i in range(na)]
    depth = sel.get("depth")
    out = []
    for fu, fv in fractions:
        p = centre + a * (a_min + fu * (a_max - a_min)) + b * (b_min + fv * (b_max - b_min))
        if depth is not None and abs(n.z) < 0.5:
            # A side face: sample `depth` below its top edge instead of the grid's b position.
            top_z = max(vt.Point.z for vt in face.Vertexes)
            p = App.Vector(p.x, p.y, top_z - float(depth))
        # The grid is laid on the face's bounding rectangle, so a point can land
        # in a hole (the display window in a top rim) or off a non-rectangular
        # face. Such a point is DROPPED with a warning, never snapped to the
        # nearest edge: a probe on the lip of an opening reads the fillet, not
        # the face. Curved faces are snapped by the tiny surface distance only.
        try:
            d, pts, _info = face.distToShape(__import__("Part").Vertex(p))
        except Exception:  # pragma: no cover - distToShape quirks on degenerate faces
            d, pts = 0.0, None
        if d > SNAP_MAX_MM:
            App.Console.PrintWarning("%s %s: sample (%s) is %.1f mm off the face (in a hole or past an edge) - dropped; "
                                     "give explicit points=[(u,v),...] on the material\n" % (sel["object"], sel["face"], _fmt_triple(p), d))
            continue
        if pts and d > 1e-6:
            p = pts[0][0]
        try:
            uv = face.Surface.parameter(p)
            nn = _outward_normal(face, uv[0], uv[1])
        except Exception:
            nn = n
        out.append((p, nn))
    if not out:
        raise ValueError("%s %s: every sample fell in a hole or off the face - pass points=[(u,v),...] on the material" % (sel["object"], sel["face"]))
    return out


def _transform(placement, p, n):
    if placement is None:
        return p, n
    return placement.multVec(p), placement.Rotation.multVec(n)


def _wall_point_clearance(wall, x, y):
    """Signed XY clearance of a tip-centre point from a known wall's surface (positive = free side);
    None when the point is not abreast of the wall. Mirrors wallClearance.ts pointClearance."""
    if wall.get("kind") == "arc":
        cx, cy = wall["center"]
        d = math.hypot(x - cx, y - cy)
        if wall.get("from_deg") is not None and wall.get("to_deg") is not None:
            a = (math.degrees(math.atan2(y - cy, x - cx)) + 360.0) % 360.0
            start = wall["from_deg"] % 360.0
            span = (wall["to_deg"] - wall["from_deg"]) % 360.0 or 360.0
            if (a - start) % 360.0 > span + 1e-9:
                return None
        return wall["radius"] - d if wall.get("material", "outside") == "outside" else d - wall["radius"]
    ax, ay = wall["a"]
    bx, by = wall["b"]
    nx, ny = wall["normal"]
    nl = math.hypot(nx, ny) or 1.0
    tx, ty = bx - ax, by - ay
    tl = math.hypot(tx, ty)
    if tl > 1e-9:
        along = ((x - ax) * tx + (y - ay) * ty) / tl
        if along < -1e-9 or along > tl + 1e-9:
            return None
    return ((x - ax) * nx + (y - ay) * ny) / nl


def wall_clearance_issues(approaches, known_walls, tip_radius, margin):
    """Planning check (handoff 2026-09-21 s4 0a, same rule as the MCP's wallClearance.ts): every
    station START (the approach point the head parks at before its G38.2) must keep the probe TIP -
    a ball of ``tip_radius`` (the MEASURED tip, never a guess) - at least ``margin`` clear of every
    known wall. ``known_walls`` is a list of dicts in the EMITTED frame:
    ``{"name", "kind": "line", "a": (x, y), "b": (x, y), "normal": (nx, ny)}`` (normal toward the
    FREE side) or ``{"name", "kind": "arc", "center": (x, y), "radius", "material": "outside"|"inside",
    "from_deg", "to_deg"}``, optionally ``"z_top"`` / ``"z_bottom"``. The emitter's own links run
    at the safe Z above the work, so only the starts are judged here; the MCP judges the links it
    plans as well. Returns a list of (station_name, wall_name, clearance, required) tuples."""
    required = float(tip_radius) + float(margin)
    issues = []
    for name, approach in approaches:
        for wall in known_walls:
            z_top = wall.get("z_top")
            z_bottom = wall.get("z_bottom")
            if z_top is not None and approach.z > z_top + 0.05:
                continue
            if z_bottom is not None and approach.z < z_bottom - 0.05:
                continue
            c = _wall_point_clearance(wall, approach.x, approach.y)
            if c is not None and c < required - 1e-9:
                issues.append((name, wall.get("name", "wall"), c, required))
    return issues


def emit_probe_program(doc, selections, out_path, frame="work", placement=None, clearance=10.0,
                       overtravel=10.0, safe_lift=15.0, feed=100, toolpath=None, tol=TOLERANCE_DEFAULT,
                       results=None, known_walls=None, tip_radius=None, wall_margin=None,
                       on_wall_violation="refuse"):
    """Write the program; returns (path, lines_written, probe_count).

    ``known_walls`` (with the MEASURED ``tip_radius`` and a ``wall_margin``) runs the same station-start
    clearance check the MCP applies at staging (``wall_clearance_issues``): a start inside
    tip radius + margin of a known wall raises ValueError, or prints warnings with
    ``on_wall_violation="warn"``. Pass the walls in the emitted frame (after ``placement``)."""
    if frame not in ("work", "machine"):
        raise ValueError("frame must be 'work' or 'machine'")
    if placement is not None and frame != "machine":
        raise ValueError("a placement maps CAD to MACHINE coordinates - pass frame='machine' with it")
    if clearance <= 0 or overtravel <= 0:
        raise ValueError("clearance and overtravel must be positive (the G38 target is the travel limit)")
    if known_walls:
        if tip_radius is None or wall_margin is None:
            raise ValueError("known_walls needs tip_radius (the MEASURED probe tip radius) and wall_margin - no default")
    name = toolpath or ("%s_probe" % doc.Name)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    res = dict(documentid=doc.Name, modelversion=str(getattr(doc, "LastModifiedDate", "") or "1").replace(" ", "_"),
               toolpathid="1.00001", toolpath=name.replace(" ", "_"))
    if results:
        res.update(results)
    probes = []  # (meta dict, approach Vector, target Vector, nominal, normal)
    pid = 0
    for sel in selections:
        face = _face_of(doc, sel["object"], sel["face"])
        pts = _sample_points(face, sel)
        base = sel.get("name") or ("%s_%s" % (sel["object"], sel["face"]))
        for k, (p, n) in enumerate(pts):
            pid += 1
            p_m, n_m = _transform(placement, p, n)
            approach = p_m + n_m * clearance
            target = p_m - n_m * overtravel
            tu, tl = sel.get("tol", tol)
            meta = dict(id=pid, name=base if len(pts) == 1 else "%s_%d" % (base, k + 1),
                        group=sel.get("group"), role=sel.get("role"),
                        nominal=_fmt_triple(p_m), normal=_fmt_triple(n_m),
                        tol="%s,%s" % (_r3(abs(tu)), _r3(abs(tl))), offset=_r3(float(sel.get("offset", 0))), frame=frame)
            probes.append((meta, approach, target, p_m, n_m))
    if not probes:
        raise ValueError("no probe points - check the selections")
    if known_walls:
        issues = wall_clearance_issues([(m["name"], a) for m, a, _t, _p, _n in probes], known_walls, tip_radius, wall_margin)
        if issues:
            text = "; ".join("station %s: tip centre %.3f mm from known wall %s (needs tip radius + margin = %.3f)" % (s, c, w, r)
                             for s, w, c, r in issues)
            if on_wall_violation != "warn":
                raise ValueError("wall clearance: " + text + " - move the station starts (corner arcs radially from the fitted centre)")
            App.Console.PrintWarning("wall clearance: %s\n" % text)
    safe_z = max(a.z for _m, a, _t, _p, _n in probes) + safe_lift
    lines = [
        "%",
        "(Luban MCP run_probing_gcode program - emitted by freecad_probe_emitter.py %s)" % stamp,
        "(Source: FreeCAD document %s. Coordinates: %s frame%s.)" % (
            doc.Name, frame.upper(), "" if placement is None else ", CAD mapped through the stated placement"),
        "(Every G38.2 marches along the INWARD face normal from %s mm outside to %s mm past the nominal surface.)" % (_r3(clearance), _r3(overtravel)),
        "(TIP CONVENTION: nominals are SURFACE points. The MCP's contact is the tip REFERENCE point - stylus-centre XY, "
        "stylus-BOTTOM Z - and it compares surface = contact + (0,0,r) - r*normal: no correction on a -Z march, one tip radius on a side march.)",
        "(Stage with run_probing_gcode frame=%s; the MCP re-derives links and marches under the motion laws.)" % frame,
        "(RESULTS documentid=%(documentid)s modelversion=%(modelversion)s toolpathid=%(toolpathid)s toolpath=%(toolpath)s)" % res,
        "G90 G94 G17 G21",
        "G0 Z%s" % _r3(safe_z),
    ]
    for meta, approach, target, _p, _n in probes:
        lines.append("G0 X%s Y%s" % (_r3(approach.x), _r3(approach.y)))
        lines.append("G0 Z%s" % _r3(approach.z))
        kv = " ".join("%s=%s" % (k, v) for k, v in meta.items() if v is not None and v != "")
        lines.append("(PROBE %s)" % kv)
        lines.append("G38.2 X%s Y%s Z%s F%d" % (_r3(target.x), _r3(target.y), _r3(target.z), int(feed)))
        lines.append("G0 X%s Y%s Z%s" % (_r3(approach.x), _r3(approach.y), _r3(approach.z)))
        lines.append("G0 Z%s" % _r3(safe_z))
    lines += ["M30", "%"]
    out_path = os.path.abspath(out_path)
    with open(out_path, "w", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    return out_path, len(lines), len(probes)


def selections_from_gui(name_prefix="sel"):
    """Turn the current GUI selection (faces) into a selections list for emit_probe_program."""
    import FreeCADGui as Gui
    out = []
    for so in Gui.Selection.getSelectionEx():
        for i, sub in enumerate(so.SubElementNames):
            if sub.startswith("Face"):
                out.append({"object": so.ObjectName, "face": sub, "name": "%s_%s_%s" % (name_prefix, so.ObjectName, sub)})
    if not out:
        raise ValueError("select one or more faces first")
    return out


def describe(doc, selections):
    """Dry run: print each sample point and normal without writing anything."""
    for sel in selections:
        face = _face_of(doc, sel["object"], sel["face"])
        for p, n in _sample_points(face, sel):
            App.Console.PrintMessage("%s %s: nominal (%s) normal (%s)\n" % (
                sel["object"], sel["face"], _fmt_triple(p), _fmt_triple(n)))
