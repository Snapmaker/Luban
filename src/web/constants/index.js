// Metric and Imperial units
export const IMPERIAL_UNITS = 'in';
export const METRIC_UNITS = 'mm';

export const EPSILON = 1e-6;

// Controller
export const GRBL = 'Grbl';
export const MARLIN = 'Marlin';
export const SMOOTHIE = 'Smoothie';
export const TINYG = 'TinyG';

// Workflow State
export const WORKFLOW_STATE_RUNNING = 'running';
export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

// Stages for Laser and CNC Carving
export const STAGE_IDLE = 0;
export const STAGE_IMAGE_LOADED = 1;
export const STAGE_PREVIEWING = 2;
export const STAGE_PREVIEWED = 3;
export const STAGE_GENERATED = 4;

// Stages for 3d print
export const STAGES_3DP = {
    noModel: 10,
    modelLoaded: 11,
    gcodeRendered: 12
};

export const WEB_CACHE_IMAGE = './images/_cache';

export const CNC_TOOL_SNAP_V_BIT = 'snap.v-bit';
export const CNC_TOOL_SNAP_V_BIT_CONFIG = { diameter: 3.175, angle: 30 };
export const CNC_TOOL_SNAP_FLAT_END_MILL = 'snap.flat-end-mill';
export const CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG = { diameter: 3.175, angle: 180 };
export const CNC_TOOL_SNAP_BALL_END_MILL = 'snap.ball-end-mill';
export const CNC_TOOL_SNAP_BALL_END_MILL_CONFIG = { diameter: 3.175, angle: 180 };
export const CNC_TOOL_CUSTOM = 'custom';
export const CNC_TOOL_CUSTOM_CONFIG = { diameter: 3.175, angle: 180 };

// actions start with 'ACTION_REQ' are action requests
// actions start with 'ACTION_CHANGE' are value spreads
export const ACTION_REQ_GENERATE_GCODE_3DP = 'ACTION_REQ.GENERATE_GCODE.3DP';
export const ACTION_REQ_LOAD_GCODE_3DP = 'ACTION_REQ.LOAD_GCODE.3DP';
export const ACTION_REQ_EXPORT_GCODE_3DP = 'ACTION_REQ.EXPORT_GCODE.3DP';

export const ACTION_CHANGE_STAGE_3DP = 'ACTION_CHANGE.STAGE.3DP';

// 3DP
export const ACTION_3DP_CONFIG_LOADED = 'ACTION_3DP_CONFIG_LOADED';
export const ACTION_3DP_MODEL_OVERSTEP_CHANGE = 'ACTION_3DP_MODEL_OVERSTEP_CHANGE';
export const ACTION_3DP_GCODE_OVERSTEP_CHANGE = 'ACTION_3DP_GCODE_OVERSTEP_CHANGE';
export const ACTION_3DP_EXPORT_MODEL = 'ACTION_3DP_EXPORT_MODEL';
export const ACTION_3DP_LOAD_MODEL = 'ACTION_3DP_LOAD_MODEL';

export const LASER_GCODE_SUFFIX = '.nc';
export const CNC_GCODE_SUFFIX = '.cnc';
export const THREE_DP_GCODE_SUFFIX = '.gcode';
