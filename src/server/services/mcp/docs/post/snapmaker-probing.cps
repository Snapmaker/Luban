/**
  Snapmaker (Marlin) PROBING & INSPECTION post processor for Autodesk Fusion 360 / HSMWorks / Inventor CAM

  Part of Snapmaker Luban (fork tyeth/Luban, MCP server) - AGPL-3.0-or-later, same as the repository.
  Written 2026-09-07 from the review in ../FUSION_POST_REVIEW.md; written WITHOUT access to a Fusion
  installation. It follows the Autodesk post kernel API as used by the library posts, but every cycle
  geometry below must be verified in the Fusion post editor against a real Probe / Inspect Surface
  operation before it is trusted. Treat the first outputs as fixtures for run_probing_gcode, not as
  programs to run.

  WHAT IT EMITS
    A program in the exact dialect the Luban MCP tool `run_probing_gcode` translates:
      - G90 G94 G17 G21 header; NO M3/M4, NO M6, NO G28, NO G92, NO tool length compensation, NO arcs.
      - Every probe cycle as: raise to the safe traverse height, G0 to the approach XY, G0 down to the
        approach Z, a "(PROBE ...)" metadata comment, then ONE G38.2 toward a target placed past the
        expected surface by a GENEROUS overtravel (the target is the MCP's travel limit; a short march
        silently misses the face - see the README).
      - 3+2 stations as a bare "G0 B<angle>" line, always preceded by a raise to the traverse height.
        XYZ are post-transformed into the station's work plane (optimizeMachineAngles2(1), no G68.2).
      - "(RESULTS documentid= modelversion= toolpathid= toolpath=)" once per operation so the MCP's
        inspection report carries the Fusion identity for "Import inspection results".
    Feeds are written for readability only; the MCP runs its own sensor-gated march (coarse F100,
    fine F60) and ignores them.

  WHAT IT REFUSES
    Milling operations (this post is for probing sections only), simultaneous multi-axis motion,
    inch units, PCD probing cycles, arcs.

  THE ROTARY AXIS
    createAxis() below has no offset: Fusion then assumes the B axis passes through the WCS origin.
    Either place the setup WCS origin ON the rotary centreline (the MCP's stored geometry: axis X ~169.7,
    physical Z ~112.4 in machine coordinates) or fill the offset property with the WCS-relative axis
    position. Get this wrong and every 3+2 point is silently displaced. The B sign must be verified on
    the machine (property bAxisSign).
*/

description = "Snapmaker (Marlin) - Probing & Inspection for the Luban MCP";
vendor = "Snapmaker Luban MCP (community)";
vendorUrl = "https://github.com/tyeth/Luban";
legal = "AGPL-3.0-or-later";
certificationLevel = 2;
minimumRevision = 45702;

longDescription = "Probing and Inspect Surface operations only, emitted as Grbl/Marlin G38.2 cycles with "
  + "(PROBE ...) metadata for the Luban MCP run_probing_gcode translator. 3+2 via a bare B word after a raise "
  + "to the safe traverse height. Set the WCS origin on the rotary axis or fill the axis offset property.";

extension = "nc";
setCodePage("ascii");

capabilities = CAPABILITY_MILLING | CAPABILITY_INSPECTION;
tolerance = spatial(0.002, MM);
minimumChordLength = spatial(0.01, MM);
minimumCircularRadius = spatial(0.01, MM);
maximumCircularRadius = spatial(1000, MM);
minimumCircularSweep = toRad(0.01);
maximumCircularSweep = toRad(180);
allowHelicalMoves = false;
allowedCircularPlanes = 0; // no arcs: the translator refuses G2/G3
probeMultipleFeatures = true;

// ---------------------------------------------------------------- properties

properties = {
  traverseZ: {
    title      : "Safe traverse height (machine Z)",
    description: "The MCP's mcpSafeTraverseZ (law 2). Written as G53 G0 Z before every XY link and every B rotation.",
    group      : "safety",
    type       : "number",
    value      : 320,
    scope      : "post"
  },
  minOvertravel: {
    title      : "Minimum overtravel past the expected surface (mm)",
    description: "The G38.2 target is the travel LIMIT. Estimate error must fit inside it: 15 mm found a face that an 11 mm march missed.",
    group      : "safety",
    type       : "number",
    value      : 15,
    scope      : "post"
  },
  bAxisSign: {
    title      : "B axis sign",
    description: "+1 or -1. VERIFY ON THE MACHINE with a small rotation before trusting a 3+2 program.",
    group      : "rotary",
    type       : "number",
    value      : 1,
    scope      : "post"
  },
  bAxisOffsetX: {
    title      : "Rotary axis X relative to the WCS origin (mm)",
    description: "0 when the WCS origin lies on the rotary centreline. Otherwise the axis X in WCS coordinates.",
    group      : "rotary",
    type       : "number",
    value      : 0,
    scope      : "post"
  },
  bAxisOffsetZ: {
    title      : "Rotary axis Z relative to the WCS origin (mm)",
    description: "0 when the WCS origin lies on the rotary centreline. Otherwise the axis Z in WCS coordinates.",
    group      : "rotary",
    type       : "number",
    value      : 0,
    scope      : "post"
  },
  writeProbeMeta: {
    title      : "Write (PROBE ...) metadata comments",
    description: "Nominals, normals, tolerances and feature grouping for the inspection report. Leave on.",
    group      : "output",
    type       : "boolean",
    value      : true,
    scope      : "post"
  },
  probeFeed: {
    title      : "Probe feed written on G38.2 (cosmetic)",
    description: "The MCP ignores programmed feeds; this is for readers of the file.",
    group      : "output",
    type       : "number",
    value      : 100,
    scope      : "post"
  },
  showSequenceNumbers: {
    title      : "Sequence numbers",
    description: "Write N words.",
    group      : "output",
    type       : "boolean",
    value      : false,
    scope      : "post"
  }
};

// ---------------------------------------------------------------- formats

var gFormat = createFormat({prefix: "G", decimals: 1});
var mFormat = createFormat({prefix: "M", decimals: 0});
var xyzFormat = createFormat({decimals: 3, forceDecimal: true});
var abcFormat = createFormat({decimals: 3, forceDecimal: true, scale: DEG});
var feedFormat = createFormat({decimals: 0});
var secFormat = createFormat({decimals: 3, forceDecimal: true});

var xOutput = createVariable({prefix: "X"}, xyzFormat);
var yOutput = createVariable({prefix: "Y"}, xyzFormat);
var zOutput = createVariable({prefix: "Z"}, xyzFormat);
var bOutput = createVariable({prefix: "B", force: true}, abcFormat);
var feedOutput = createVariable({prefix: "F"}, feedFormat);

// NOT a modal group: Marlin (Snapmaker firmware) has no implicit modal motion - a line of bare
// axis words is not a move - and Luban's own gcode carries G0/G1 on every line. The MCP
// translator tracks modal state itself, but the program must read the same to a human and to
// any plain sender. Same interface as createModal so call sites stay familiar.
var gMotionModal = {
  format: function (code) { return gFormat.format(code); },
  reset : function () {}
};
var gAbsIncModal = createModal({}, gFormat); // G90-91
var gUnitModal = createModal({}, gFormat);   // G20-21

var sequenceNumber = 10;
var probeId = 0;
var currentB = undefined;
var currentMachineABC = undefined;
var pendingApproach = undefined;
var groupIndex = 0;

// ---------------------------------------------------------------- helpers

function writeBlock() {
  var text = formatWords(arguments);
  if (!text) {
    return;
  }
  if (getProperty("showSequenceNumbers")) {
    writeWords2("N" + sequenceNumber, arguments);
    sequenceNumber += 1;
  } else {
    writeWords(arguments);
  }
}

function formatComment(text) {
  return "(" + String(text).replace(/[()]/g, "") + ")";
}

function writeComment(text) {
  writeln(formatComment(text));
}

function n3(v) {
  return xyzFormat.format(v);
}

function triple(v) {
  return n3(v.x) + "," + n3(v.y) + "," + n3(v.z);
}

/** Raise to the traverse height in MACHINE coordinates (G53 on its own line, as the translator wants). */
function writeTraverseHeight() {
  // G0 written explicitly every time: a "G53 Z320." without its motion word is legal for the
  // translator (G0 stays modal) but reads as an unqualified move on the confirm page.
  gMotionModal.reset();
  writeBlock(gFormat.format(53), gMotionModal.format(0), "Z" + n3(getProperty("traverseZ")));
  zOutput.reset();
}

/** Law 2 link: raise, XY at the traverse height, descend to the approach Z. */
function writeApproach(p) {
  writeTraverseHeight();
  writeBlock(gMotionModal.format(0), xOutput.format(p.x), yOutput.format(p.y));
  writeBlock(gMotionModal.format(0), zOutput.format(p.z));
}

function writeProbeMeta(meta) {
  if (!getProperty("writeProbeMeta")) {
    return;
  }
  var parts = ["PROBE", "id=" + meta.id, "name=" + meta.name];
  if (meta.group) {
    parts.push("group=" + meta.group);
  }
  if (meta.role) {
    parts.push("role=" + meta.role);
  }
  if (meta.feature) {
    parts.push("feature=" + meta.feature);
  }
  parts.push("nominal=" + triple(meta.nominal));
  parts.push("normal=" + triple(meta.normal));
  if (meta.tolU !== undefined || meta.tolL !== undefined) {
    parts.push("tol=" + n3(meta.tolU || 0) + "," + n3(meta.tolL || 0));
  }
  if (meta.offset !== undefined) {
    parts.push("offset=" + n3(meta.offset));
  }
  if (meta.nominalSize !== undefined) {
    parts.push("nominal_size=" + n3(meta.nominalSize));
  }
  if (meta.center !== undefined) {
    parts.push("nominal_center=" + n3(meta.center.x) + "," + n3(meta.center.y));
  }
  if (meta.tolSize !== undefined) {
    parts.push("tol_size=" + n3(meta.tolSize));
  }
  if (meta.tolPos !== undefined) {
    parts.push("tol_pos=" + n3(meta.tolPos));
  }
  writeComment(parts.join(" "));
}

/**
 * One measurement: law-2 approach to `approach`, metadata, ONE G38.2 toward `target`.
 * The MCP retreats to `approach` after the cycle, so nothing else is written.
 */
function writeProbe(meta, approach, target) {
  var travel = Vector.diff(target, approach).length;
  if (travel > 150) {
    error(subst(localize("Probe '%1': travel %2 mm exceeds the 150 mm limit of run_probing_gcode."), meta.name, n3(travel)));
    return;
  }
  if (target.z > approach.z + 1e-6) {
    error(subst(localize("Probe '%1': upward probing is refused by the MCP translator."), meta.name));
    return;
  }
  probeId += 1;
  meta.id = probeId;
  writeApproach(approach);
  writeProbeMeta(meta);
  xOutput.reset();
  yOutput.reset();
  zOutput.reset();
  writeBlock(gFormat.format(38.2), xOutput.format(target.x), yOutput.format(target.y), zOutput.format(target.z),
    feedOutput.format(getProperty("probeFeed")));
  feedOutput.reset();
  xOutput.reset();
  yOutput.reset();
  zOutput.reset();
}

/** Convert a Fusion approach ("positive"/"negative") to a sign. */
function approachSign(value) {
  validate((value == "positive") || (value == "negative"), "Invalid approach.");
  return (value == "positive") ? 1 : -1;
}

function overtravel() {
  return Math.max(cycle.probeOvertravel || 0, getProperty("minOvertravel"));
}

function operationComment() {
  return hasParameter("operation-comment") ? String(getParameter("operation-comment")).replace(/\s+/g, "_") : "op";
}

// ---------------------------------------------------------------- machine configuration (rotary B along Y)

function defineMachine() {
  var bAxis = createAxis({
    coordinate: 1,
    table     : true,
    axis      : [0, 1, 0],
    offset    : [getProperty("bAxisOffsetX"), 0, getProperty("bAxisOffsetZ")],
    cyclic    : true,
    preference: 1,
    range     : [-360, 360]
  });
  machineConfiguration = new MachineConfiguration(bAxis);
  setMachineConfiguration(machineConfiguration);
  optimizeMachineAngles2(1); // map tip mode: post-transformed XYZ, bare B word, no G68.2
}

function getWorkPlaneMachineABC(workPlane) {
  var W = workPlane;
  var abc = machineConfiguration.getABC(W);
  abc = machineConfiguration.getPreferredABC(abc);
  try {
    abc = machineConfiguration.remapABC(abc);
    currentMachineABC = abc;
  } catch (e) {
    error(localize("Machine angles not supported") + ":" + conditional(machineConfiguration.isMachineCoordinate(0), " A" + abcFormat.format(abc.x))
      + conditional(machineConfiguration.isMachineCoordinate(1), " B" + abcFormat.format(abc.y))
      + conditional(machineConfiguration.isMachineCoordinate(2), " C" + abcFormat.format(abc.z)));
  }
  var direction = machineConfiguration.getDirection(abc);
  if (!isSameDirection(direction, W.forward)) {
    error(localize("Orientation not supported."));
  }
  if (!machineConfiguration.isABCSupported(abc)) {
    error(localize("Work plane is not supported") + ":" + " B" + abcFormat.format(abc.y));
  }
  // Post-transformed coordinates: rotate the toolpath by the remaining orientation.
  var R = machineConfiguration.getRemainingOrientation(abc, W);
  setRotation(R);
  return abc;
}

/** Indexing only: raise to the traverse height, then the bare B word. */
function setWorkPlane(abc) {
  if (abcFormat.areDifferent(abc.x, 0) || abcFormat.areDifferent(abc.z, 0)) {
    error(localize("Only a B rotation is available on the Snapmaker rotary module."));
    return;
  }
  if (currentB !== undefined && !abcFormat.areDifferent(abc.y, currentB)) {
    return;
  }
  writeComment("B rotation: raise to the traverse height first (law 2), then rotate on its own line");
  writeTraverseHeight();
  // The raise just made G0 modal; force it back out so the rotation reads "G0 B..", never a bare "B..".
  gMotionModal.reset();
  writeBlock(gMotionModal.format(0), bOutput.format(getProperty("bAxisSign") * abc.y));
  currentB = abc.y;
}

// ---------------------------------------------------------------- program

function onOpen() {
  if (unit == IN) {
    error(localize("Use millimetres for Snapmaker probing programs (the MCP converts G20 but Fusion nominals would not match)."));
    return;
  }
  defineMachine();
  if (programName) {
    writeComment(programName);
  }
  writeComment("Snapmaker Luban MCP run_probing_gcode - Grbl/Marlin dialect, WORK frame (CAM WCS)");
  writeComment("Every G38.2 target is the travel LIMIT; feeds are advisory (the MCP runs its own sensor-gated march)");
  writeBlock(gAbsIncModal.format(90), gFormat.format(94), gFormat.format(17), gUnitModal.format(21));
}

function onComment(message) {
  writeComment(message);
}

function onParameter(name, value) {
}

function onSection() {
  if (!isProbeOperation() && !isInspectionOperation()) {
    error(localize("This post outputs Probe and Inspect Surface operations only. Post milling with the standard Snapmaker post."));
    return;
  }
  writeln("");
  if (hasParameter("operation-comment")) {
    writeComment(getParameter("operation-comment"));
  }
  // Fusion identity for the inspection results envelope.
  var opId = hasParameter("autodeskcam:operation-id") ? getParameter("autodeskcam:operation-id") : getCurrentSectionId() + 1;
  writeComment("RESULTS documentid=" + getGlobalParameter("document-id", "") + " modelversion=" + getGlobalParameter("model-version", "")
    + " toolpathid=" + (Number(opId) + 0.00001).toFixed(5) + " toolpath=" + operationComment());

  // 3+2: rotate (at the traverse height) before anything else in the section.
  if (machineConfiguration.isMultiAxisConfiguration()) {
    var abc = getWorkPlaneMachineABC(currentSection.workPlane);
    setWorkPlane(abc);
  } else {
    setRotation(currentSection.workPlane);
  }
  groupIndex += 1;
  pendingApproach = undefined;
  // No positioning move here: every cycle writes its own law-2 approach.
}

function onDwell(seconds) {
  writeBlock(gFormat.format(4), "S" + secFormat.format(Math.min(seconds, 60)));
}

function onRapid(_x, _y, _z) {
  // Fusion's linking moves between cycles (retract, XY at the retract height, feed height...)
  // are not written: every probe writes its own law-2 approach from the traverse height and
  // the MCP retreats to that approach point itself. Echoing them produced three raises to the
  // traverse height per point on the first Fusion run (2026-09-07).
}

function onLinear(_x, _y, _z, feed) {
  onRapid(_x, _y, _z);
}

function onRapid5D(_x, _y, _z, _a, _b, _c) {
  error(localize("Simultaneous multi-axis motion is not supported in a probing program."));
}

function onLinear5D(_x, _y, _z, _a, _b, _c, feed) {
  error(localize("Simultaneous multi-axis motion is not supported in a probing program."));
}

function onCircular(clockwise, cx, cy, cz, x, y, z, feed) {
  error(localize("Arcs have no place in a probing program."));
}

function onCycle() {
  inspectPoints = [];
}

/**
 * Probing cycles. Geometry (VERIFY in the post editor): the cycle point (x, y) is the feature
 * reference (surface, wall centre, corner or feature centre); the expected surface height is
 * z - cycle.depth; the probe starts cycle.probeClearance + tip radius away from the expected
 * surface and marches through it by the overtravel.
 */
function onCyclePoint(x, y, z) {
  if (isInspectionOperation()) {
    inspectionCyclePoint(x, y, z);
    return;
  }
  if (!isProbeOperation()) {
    error(localize("Only probing cycles are supported."));
    return;
  }
  var r = tool.diameter / 2;
  var c = cycle.probeClearance;
  var ot = overtravel();
  var zs = z - cycle.depth;
  var op = operationComment();
  // (a bare reference to an undefined kernel helper is a ReferenceError - always test with typeof)
  var group = op + "_" + groupIndex + "_" + (typeof getCurrentCyclePointIndex == "function" ? getCurrentCyclePointIndex() : probeId);
  var tolSize = cycle.toleranceSize;
  var tolPos = cycle.tolerancePosition;

  function face(axis, sign, at, along, name, feature, extra) {
    // Probe the face of `feature` at coordinate `at` on `axis`, from the `sign` side, at `along` on the other axis.
    var approach = axis == "x" ? new Vector(at + sign * (c + r), along, zs) : new Vector(along, at + sign * (c + r), zs);
    var target = axis == "x" ? new Vector(at - sign * ot, along, zs) : new Vector(along, at - sign * ot, zs);
    var nominal = axis == "x" ? new Vector(at, along, zs) : new Vector(along, at, zs);
    var normal = axis == "x" ? new Vector(sign, 0, 0) : new Vector(0, sign, 0);
    var meta = {
      name   : name,
      group  : group,
      role   : axis + (sign > 0 ? "_plus" : "_minus"),
      feature: feature,
      nominal: nominal,
      normal : normal,
      tolSize: tolSize,
      tolPos : tolPos
    };
    for (var k in (extra || {})) {
      meta[k] = extra[k];
    }
    writeProbe(meta, approach, target);
  }

  switch (cycleType) {
  case "probing-z":
    writeProbe({
      name: op + "_z", group: group, role: "z", feature: "point",
      nominal: new Vector(x, y, zs), normal: new Vector(0, 0, 1), tolSize: tolSize, tolPos: tolPos
    }, new Vector(x, y, Math.min(zs + c, cycle.retract)), new Vector(x, y, zs - ot));
    break;
  case "probing-x":
    face("x", approachSign(cycle.approach1), x, y, op + "_x", "point");
    break;
  case "probing-y":
    face("y", approachSign(cycle.approach1), y, x, op + "_y", "point");
    break;
  case "probing-x-wall":
    face("x", 1, x + cycle.width1 / 2, y, op + "_xp", "web", {nominalSize: cycle.width1, center: {x: x, y: y}});
    face("x", -1, x - cycle.width1 / 2, y, op + "_xm", "web", {nominalSize: cycle.width1, center: {x: x, y: y}});
    break;
  case "probing-y-wall":
    face("y", 1, y + cycle.width1 / 2, x, op + "_yp", "web", {nominalSize: cycle.width1, center: {x: x, y: y}});
    face("y", -1, y - cycle.width1 / 2, x, op + "_ym", "web", {nominalSize: cycle.width1, center: {x: x, y: y}});
    break;
  case "probing-x-channel":
    // Inside the channel: start near the centre, march outward to each wall (normal points into the channel).
    face("x", -1, x + cycle.width1 / 2, y, op + "_xp", "pocket", {nominalSize: cycle.width1, center: {x: x, y: y}, role: "x_plus"});
    face("x", 1, x - cycle.width1 / 2, y, op + "_xm", "pocket", {nominalSize: cycle.width1, center: {x: x, y: y}, role: "x_minus"});
    break;
  case "probing-y-channel":
    face("y", -1, y + cycle.width1 / 2, x, op + "_yp", "pocket", {nominalSize: cycle.width1, center: {x: x, y: y}, role: "y_plus"});
    face("y", 1, y - cycle.width1 / 2, x, op + "_ym", "pocket", {nominalSize: cycle.width1, center: {x: x, y: y}, role: "y_minus"});
    break;
  case "probing-xy-circular-boss":
  case "probing-xy-rectangular-boss": {
    var wx = cycle.width1 / 2;
    var wy = (cycleType == "probing-xy-circular-boss" ? cycle.width1 : cycle.width2) / 2;
    var f = cycleType == "probing-xy-circular-boss" ? "boss" : "web";
    var ex = {nominalSize: cycle.width1, center: {x: x, y: y}};
    face("x", 1, x + wx, y, op + "_xp", f, ex);
    face("x", -1, x - wx, y, op + "_xm", f, ex);
    face("y", 1, y + wy, x, op + "_yp", f, ex);
    face("y", -1, y - wy, x, op + "_ym", f, ex);
    break;
  }
  case "probing-xy-circular-hole":
  case "probing-xy-rectangular-hole": {
    var hx = cycle.width1 / 2;
    var hy = (cycleType == "probing-xy-circular-hole" ? cycle.width1 : cycle.width2) / 2;
    var hf = cycleType == "probing-xy-circular-hole" ? "hole" : "pocket";
    var hex = {nominalSize: cycle.width1, center: {x: x, y: y}};
    // From inside: the probe starts c + r short of each wall and marches outward; the wall's normal points inward.
    face("x", -1, x + hx, y, op + "_xp", hf, {nominalSize: hex.nominalSize, center: hex.center, role: "x_plus"});
    face("x", 1, x - hx, y, op + "_xm", hf, {nominalSize: hex.nominalSize, center: hex.center, role: "x_minus"});
    face("y", -1, y + hy, x, op + "_yp", hf, {nominalSize: hex.nominalSize, center: hex.center, role: "y_plus"});
    face("y", 1, y - hy, x, op + "_ym", hf, {nominalSize: hex.nominalSize, center: hex.center, role: "y_minus"});
    break;
  }
  case "probing-xy-outer-corner": {
    var s1 = approachSign(cycle.approach1);
    var s2 = approachSign(cycle.approach2);
    var sp = cycle.probeSpacing || (c + r);
    // The part lies at x - s1, y - s2 of the corner; probe each face a little way from the corner.
    face("x", s1, x, y - s2 * sp, op + "_cx", "corner", {center: {x: x, y: y}});
    face("y", s2, y, x - s1 * sp, op + "_cy", "corner", {center: {x: x, y: y}});
    break;
  }
  case "probing-xy-inner-corner": {
    var i1 = approachSign(cycle.approach1);
    var i2 = approachSign(cycle.approach2);
    var isp = cycle.probeSpacing || (c + r);
    // The pocket interior lies at x - i1, y - i2 of the corner; start inside, march into each wall.
    face("x", -i1, x, y - i2 * isp, op + "_cx", "corner", {center: {x: x, y: y}, role: i1 > 0 ? "x_plus" : "x_minus"});
    face("y", -i2, y, x - i1 * isp, op + "_cy", "corner", {center: {x: x, y: y}, role: i2 > 0 ? "y_plus" : "y_minus"});
    break;
  }
  case "probing-x-plane-angle": {
    var a1 = approachSign(cycle.approach1);
    var half = (cycle.probeSpacing || 10) / 2;
    face("x", a1, x, y - half, op + "_a1", "point");
    face("x", a1, x, y + half, op + "_a2", "point");
    break;
  }
  case "probing-y-plane-angle": {
    var b1 = approachSign(cycle.approach1);
    var bhalf = (cycle.probeSpacing || 10) / 2;
    face("y", b1, y, x - bhalf, op + "_a1", "point");
    face("y", b1, y, x + bhalf, op + "_a2", "point");
    break;
  }
  default:
    error(subst(localize("Probing cycle '%1' is not supported by the Snapmaker probing post (PCD and island cycles: probe the features separately)."), cycleType));
  }
}

/**
 * Inspect Surface. Fusion delivers approach, measure and retract points for every surface point,
 * with the nominal point and normal on the cycle record. The points are buffered per cycle and
 * emitted from onCycleEnd, so nothing here depends on the kernel's point-index helpers
 * (getNumberOfCyclePoints / isFirstCyclePoint / isLastCyclePoint) or on how many points one cycle
 * carries: groups of three are approach/measure/retract, two are approach/measure, a lone point is
 * a measure whose approach is synthesised along the normal.
 */
var inspectPoints = [];

function inspectionCyclePoint(x, y, z) {
  inspectPoints.push({
    p        : new Vector(x, y, z),
    nominal  : new Vector(cycle.nominalX || 0, cycle.nominalY || 0, cycle.nominalZ || 0),
    normal   : new Vector(cycle.nominalI || 0, cycle.nominalJ || 0, cycle.nominalK || 1),
    clearance: cycle.probeClearance
  });
}

function scaled(v, s) {
  return new Vector(v.x * s, v.y * s, v.z * s);
}

function flushInspection() {
  var pts = inspectPoints;
  inspectPoints = [];
  if (pts.length == 0) {
    return;
  }
  var stride = (pts.length % 3 == 0) ? 3 : ((pts.length % 2 == 0) ? 2 : 1);
  var m = getRotation();
  var op = operationComment();
  var ot = getProperty("minOvertravel");
  for (var i = 0; i < pts.length; i += stride) {
    var rec = pts[stride == 1 ? i : i + 1]; // the measure point carries the nominal
    var normal = m.multiply(rec.normal).getNormalized();
    var nominal = m.multiply(rec.nominal);
    var measure = rec.p;
    var approach;
    if (stride == 1) {
      // No approach point supplied: start a clearance away from the surface along its normal.
      approach = Vector.sum(measure, scaled(normal, Math.max(rec.clearance || 0, 5)));
    } else {
      approach = pts[i].p;
    }
    // Fusion's middle point is already the END of its probing move (the nominal plus Fusion's own
    // overtravel), and the move runs along the probe direction Fusion chose - for a chamfer that is
    // an axis direction, NOT the surface normal (first Fusion run, 2026-09-07). Keep that direction;
    // only extend along it until at least minOvertravel lies past the nominal surface.
    var stroke = Vector.diff(measure, approach);
    var dir = stroke.length > 1e-6 ? stroke.getNormalized() : scaled(normal, -1);
    var past = Vector.dot(Vector.diff(measure, nominal), dir);
    var target = past >= ot ? measure : Vector.sum(measure, scaled(dir, ot - past));
    writeProbe({
      name   : op + "_" + (probeId + 1),
      group  : op + "_" + groupIndex,
      role   : "surface",
      feature: "point",
      nominal: nominal,
      normal : normal,
      tolU   : hasParameter("operation:inspectUpperTolerance") ? getParameter("operation:inspectUpperTolerance") : undefined,
      tolL   : hasParameter("operation:inspectLowerTolerance") ? getParameter("operation:inspectLowerTolerance") : undefined,
      offset : hasParameter("operation:inspectSurfaceOffset") ? getParameter("operation:inspectSurfaceOffset") : undefined
    }, approach, target);
  }
}

function onCycleEnd() {
  if (isInspectionOperation()) {
    flushInspection();
  }
  pendingApproach = undefined;
}

function onCommand(command) {
  switch (command) {
  case COMMAND_PROBE_ON:
  case COMMAND_PROBE_OFF:
    // Fusion brackets every Probe / Inspect Surface operation with these (first Fusion run,
    // 2026-09-07: "Unsupported probe-on command" killed the post at record 400). The MCP's
    // probe feed is armed by the operator's approval, not by the program, so nothing is written.
    return;
  case COMMAND_START_SPINDLE:
  case COMMAND_SPINDLE_CLOCKWISE:
  case COMMAND_SPINDLE_COUNTERCLOCKWISE:
  case COMMAND_STOP_SPINDLE:
  case COMMAND_COOLANT_ON:
  case COMMAND_COOLANT_OFF:
  case COMMAND_STOP:
  case COMMAND_OPTIONAL_STOP:
  case COMMAND_LOCK_MULTI_AXIS:
  case COMMAND_UNLOCK_MULTI_AXIS:
  case COMMAND_TOOL_MEASURE:
  case COMMAND_BREAK_CONTROL:
  case COMMAND_START_CHIP_TRANSPORT:
  case COMMAND_STOP_CHIP_TRANSPORT:
    return; // deliberately silent: no spindle, coolant, pauses or tool measurement in a probing program
  }
  onUnsupportedCommand(command);
}

function onSectionEnd() {
  forceAny();
}

function forceAny() {
  xOutput.reset();
  yOutput.reset();
  zOutput.reset();
  feedOutput.reset();
}

function onClose() {
  writeln("");
  writeTraverseHeight();
  if (currentB !== undefined && abcFormat.areDifferent(currentB, 0)) {
    gMotionModal.reset();
    writeBlock(gMotionModal.format(0), bOutput.format(0)); // unwind at the traverse height
  }
  writeBlock(mFormat.format(30));
}
