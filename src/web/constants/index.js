// Metric and Imperial units
export const IMPERIAL_UNITS = 'in';
export const METRIC_UNITS = 'mm';

// Controller
export const GRBL = 'Grbl';
export const MARLIN = 'Marlin';
export const SMOOTHIE = 'Smoothie';
export const TINYG = 'TinyG';

// Workflow State
export const WORKFLOW_STATE_RUNNING = 'running';
export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

// Grbl Active State
export const GRBL_ACTIVE_STATE_IDLE = 'Idle';
export const GRBL_ACTIVE_STATE_RUN = 'Run';
export const GRBL_ACTIVE_STATE_HOLD = 'Hold';
export const GRBL_ACTIVE_STATE_DOOR = 'Door';
export const GRBL_ACTIVE_STATE_HOME = 'Home';
export const GRBL_ACTIVE_STATE_SLEEP = 'Sleep';
export const GRBL_ACTIVE_STATE_ALARM = 'Alarm';
export const GRBL_ACTIVE_STATE_CHECK = 'Check';

// Smoothie Active State
export const SMOOTHIE_ACTIVE_STATE_IDLE = 'Idle';
export const SMOOTHIE_ACTIVE_STATE_RUN = 'Run';
export const SMOOTHIE_ACTIVE_STATE_HOLD = 'Hold';
export const SMOOTHIE_ACTIVE_STATE_DOOR = 'Door';
export const SMOOTHIE_ACTIVE_STATE_HOME = 'Home';
export const SMOOTHIE_ACTIVE_STATE_ALARM = 'Alarm';
export const SMOOTHIE_ACTIVE_STATE_CHECK = 'Check';

// TinyG Machine State
// https://github.com/synthetos/g2/wiki/Status-Reports#stat-values
export const TINYG_MACHINE_STATE_INITIALIZING = 0; // Machine is initializing
export const TINYG_MACHINE_STATE_READY = 1; // Machine is ready for use
export const TINYG_MACHINE_STATE_ALARM = 2; // Machine is in alarm state
export const TINYG_MACHINE_STATE_STOP = 3; // Machine has encountered program stop
export const TINYG_MACHINE_STATE_END = 4; // Machine has encountered program end
export const TINYG_MACHINE_STATE_RUN = 5; // Machine is running
export const TINYG_MACHINE_STATE_HOLD = 6; // Machine is holding
export const TINYG_MACHINE_STATE_PROBE = 7; // Machine is in probing operation
export const TINYG_MACHINE_STATE_CYCLE = 8; // Reserved for canned cycles (not used)
export const TINYG_MACHINE_STATE_HOMING = 9; // Machine is in a homing cycle
export const TINYG_MACHINE_STATE_JOG = 10; // Machine is in a jogging cycle
export const TINYG_MACHINE_STATE_INTERLOCK = 11; // Machine is in safety interlock hold
export const TINYG_MACHINE_STATE_SHUTDOWN = 12; // Machine is in shutdown state. Will not process commands
export const TINYG_MACHINE_STATE_PANIC = 13; // Machine is in panic state. Needs to be physically reset

// Snapmaker max bound size
export const BOUND_SIZE = 125;

// 3D
export const WEB_CURA_CONFIG_DIR = '../CuraEngine/Config';

// Stages for Laser and CNC Carving
export const STAGE_IDLE = 0;
export const STAGE_IMAGE_LOADED = 1;
export const STAGE_PREVIEWED = 2;
export const STAGE_GENERATED = 3;

export const WEB_CACHE_IMAGE = './images/_cache';

export const DEFAULT_MATERIAL_PLA_PARAMS = {
    diameter: 1.75,
    material_bed_temperature: 50,
    material_bed_temperature_layer_0: 50,
    material_print_temperature: 198,
    material_print_temperature_layer_0: 200,
    material_final_print_temperature: 198
};
export const DEFAULT_MATERIAL_ABS_PARAMS = {
    diameter: 1.75,
    material_bed_temperature: 80,
    material_bed_temperature_layer_0: 80,
    material_print_temperature: 235,
    material_print_temperature_layer_0: 238,
    material_final_print_temperature: 235
};
export const DEFAULT_MATERIAL_CUSTOM_PARAMS = {
    diameter: 1.75,
    material_bed_temperature: 50,
    material_bed_temperature_layer_0: 50,
    material_print_temperature: 198,
    material_print_temperature_layer_0: 200,
    material_final_print_temperature: 198
};

export const DEFAULT_RASTER_IMAGE = './images/snap-logo-square-256x256.png';
export const DEFAULT_VECTOR_IMAGE = './images/snap-logo-square-256x256.png.svg';
export const DEFAULT_SIZE_WIDTH = 256;
export const DEFAULT_SIZE_HEIGHT = 256;

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
export const ACTION_CHANGE_MATERIAL_3DP = 'ACTION_CHANGE.MATERIAL.3DP';
export const ACTION_CHANGE_CAMERA_ANIMATION = 'ACTION_CHANGE.CAMERA_ANIMATION';

export const ACTION_REQ_PREVIEW_LASER = 'ACTION_REQ.PREVIEW.LASER';
export const ACTION_REQ_GENERATE_GCODE_LASER = 'ACTION_REQ.GENERATE_GCODE.LASER';

export const ACTION_CHANGE_STAGE_LASER = 'ACTION_CHANGE.STAGE.LASER';
export const ACTION_CHANGE_IMAGE_LASER = 'ACTION_CHANGE.IMAGE.LASER';
export const ACTION_CHANGE_PARAMETER_LASER = 'ACTION_CHANGE.PARAMETER.LASER';
export const ACTION_CHANGE_GENERATE_GCODE_LASER = 'ACTION_CHANGE.GENERATE_GCODE.LASER';

export const ACTION_REQ_PREVIEW_CNC = 'ACTION_REQ.PREVIEW.CNC';
export const ACTION_REQ_GENERATE_GCODE_CNC = 'ACTION_REQ.GENERATE_GCODE.CNC';

export const ACTION_CHANGE_STAGE_CNC = 'ACTION_CHANGE.STAGE.CNC';
export const ACTION_CHANGE_IMAGE_CNC = 'ACTION_CHANGE.IMAGE.CNC';
export const ACTION_CHANGE_TOOL = 'ACTION_CHANGE.TOOL';
export const ACTION_CHANGE_PATH = 'ACTION_CHANGE.PATH';
export const ACTION_CHANGE_GENERATE_GCODE_CNC = 'ACTION_CHANGE.GENERATE_GCODE.CNC';
