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

// Head Type
export const HEAD_TYPE_UNKNOWN = 'UNKNOWN';
export const HEAD_TYPE_3DP = '3DP';
export const HEAD_TYPE_LASER = 'LASER';
export const HEAD_TYPE_CNC = 'CNC';

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

const publicPath = global.PUBLIC_PATH || '';
export const DATA_PREFIX = `${publicPath}/data/Tmp`;

export const CNC_TOOL_SNAP_V_BIT = 'snap.v-bit';
export const CNC_TOOL_SNAP_V_BIT_CONFIG = { diameter: 3.175, angle: 30 };
export const CNC_TOOL_SNAP_FLAT_END_MILL = 'snap.flat-end-mill';
export const CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG = { diameter: 3.175, angle: 180 };
export const CNC_TOOL_SNAP_BALL_END_MILL = 'snap.ball-end-mill';
export const CNC_TOOL_SNAP_BALL_END_MILL_CONFIG = { diameter: 3.175, angle: 180 };
export const CNC_TOOL_CUSTOM = 'custom';
export const CNC_TOOL_CUSTOM_CONFIG = { diameter: 3.175, angle: 180 };

export const LASER_GCODE_SUFFIX = '.nc';
export const CNC_GCODE_SUFFIX = '.cnc';
export const PRINTING_GCODE_SUFFIX = '.gcode';

// Replacements for null value
export const ABSENT_VALUE = 896745231;
export const ABSENT_OBJECT = Object.freeze({});

// Experimental features
export const EXPERIMENTAL_WIFI_CONTROL = false;
export const EXPERIMENTAL_LASER_CAMERA = false;
export const EXPERIMENTAL_IMAGE_TRACING = false;
export const EXPERIMENTAL_IMAGE_TRACING_CNC = false;
export const EXPERIMENTAL_PROFILE = true;
