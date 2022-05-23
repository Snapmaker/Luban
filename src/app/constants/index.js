import { valueOf } from '../lib/contants-utils';

export const DEFAULT_LUBAN_HOST = 'luban://127.0.0.1';
// Metric and Imperial units
export const IMPERIAL_UNITS = 'in';
export const METRIC_UNITS = 'mm';

export const EPSILON = 1e-6;
export const CONNECTION_OPEN = 'connection:open';
export const CONNECTION_CLOSE = 'connection:close';
export const CONNECTION_EXECUTE_GCODE = 'connection:executeGcode';
export const CONNECTION_START_GCODE = 'connection:startGcode';
export const CONNECTION_RESUME_GCODE = 'connection:resumeGcode';
export const CONNECTION_PAUSE_GCODE = 'connection:pauseGcode';
export const CONNECTION_STOP_GCODE = 'connection:stopGcode';
export const CONNECTION_HEARTBEAT = 'connection:startHeartbeat';
export const CONNECTION_MATERIALTHICKNESS = 'connection:materialThickness';
export const CONNECTION_MATERIALTHICKNESS_ABORT = 'connection:materialThickness_abort';
export const CONNECTION_GET_GCODEFILE = 'connection:getGcodeFile';
export const CONNECTION_UPLOAD_FILE = 'connection:uploadFile';
export const CONNECTION_Z_OFFSET = 'connection:updateZOffset';
export const CONNECTION_NOZZLE_TEMPERATURE = 'connection:updateNozzleTemperature';
export const CONNECTION_WORK_NOZZLE = 'connection:updateWorkNozzle';
export const CONNECTION_BED_TEMPERATURE = 'connection:updateBedTemperature';
export const CONNECTION_LOAD_FILAMENT = 'connection:loadFilament';
export const CONNECTION_UNLOAD_FILAMENT = 'connection:unloadFilament';
export const CONNECTION_WORKSPEED_FACTOR = 'connection:updateWorkSpeedFactor';
export const CONNECTION_LASER_POWER = 'connection:updateLaserPower';
export const CONNECTION_SWITCH_LASER_POWER = 'connection:switchLaserPower';
export const CONNECTION_ENCLOSURE_LIGHT = 'connection:setEnclosureLight';
export const CONNECTION_ENCLOSURE_FAN = 'connection:setEnclosureFan';
export const CONNECTION_DOOR_DETECTION = 'connection:setDoorDetection';
export const CONNECTION_FILTER_SWITCH = 'connection:setFilterSwitch';
export const CONNECTION_FILTER_WORKSPEED = 'connection:setFilterWorkSpeed';
export const CONNECTION_GO_HOME = 'connection:goHome';
export const CONNECTION_COORDINATE_MOVE = 'connection:coordinateMove';
export const CONNECTION_SET_WORK_ORIGIN = 'connection:setWorkOrigin';
export const CONNECTION_UPDATE_TOOLHEAD_SPEED = 'connection:updateToolHeadSpeed';
export const CONNECTION_SWITCH_CNC = 'connection:switchCNC';

export const SVG_MOVE_MINI_DISTANCE = 1e-4;
export const MINIMUM_WIDTH_AND_HEIGHT = 0.01;

// Controller
export const MARLIN = 'Marlin';

// Workflow State
export const WORKFLOW_STATE_RUNNING = 'running';
export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

// Workflow status
export const WORKFLOW_STATUS_UNKNOWN = 'unknown';
export const WORKFLOW_STATUS_IDLE = 'idle';
export const WORKFLOW_STATUS_STARTING = 'starting';
export const WORKFLOW_STATUS_RUNNING = 'running';
export const WORKFLOW_STATUS_PAUSING = 'pausing';
export const WORKFLOW_STATUS_PAUSED = 'paused';
export const WORKFLOW_STATUS_STOPPING = 'stopping';
export const WORKFLOW_STATUS_STOPPED = 'stopped';
export const WORKFLOW_STATUS_FINISHING = 'finishing';
export const WORKFLOW_STATUS_COMPLETED = 'completed';
export const WORKFLOW_STATUS_RECOVERING = 'recovering';
export const WROKFLOW_STATUS_RESUMING = 'resuming';

export const WORKFLOW_STATUS_MAP = {
    '0': WORKFLOW_STATE_IDLE,
    '1': WORKFLOW_STATUS_STARTING,
    '2': WORKFLOW_STATUS_RUNNING,
    '3': WORKFLOW_STATUS_PAUSING,
    '4': WORKFLOW_STATUS_PAUSED,
    '5': WORKFLOW_STATUS_STOPPING,
    '6': WORKFLOW_STATUS_STOPPED,
    '7': WORKFLOW_STATUS_FINISHING,
    '8': WORKFLOW_STATUS_COMPLETED,
    '9': WORKFLOW_STATUS_RECOVERING,
    '10': WROKFLOW_STATUS_RESUMING
};

export const COORDINATE_AXIS = {
    'X': 0,
    'Y': 1,
    'Z': 2,
    'B': 4
};

// Workflow State

// Connection Status
export const CONNECTION_STATUS_IDLE = 'idle';
export const CONNECTION_STATUS_CONNECTING = 'connecting';
export const CONNECTION_STATUS_CONNECTED = 'connected';

// G-code Macro
export const MODAL_NONE = 'none';
export const MODAL_ADD_MACRO = 'add';
export const MODAL_EDIT_MACRO = 'edit';
export const MODAL_RUN_MACRO = 'run';

// Purifier
export const SPEED_HIGH = 3;
export const SPEED_MEDIUM = 2;
export const SPEED_LOW = 1;

// Stages for Laser and CNC Carving
export const STAGE_IDLE = 0;
export const STAGE_IMAGE_LOADED = 1;
export const STAGE_PREVIEWING = 2;
export const STAGE_PREVIEWED = 3;
export const STAGE_GENERATED = 4;

export const PAGE_EDITOR = 'editor';
export const PAGE_PROCESS = 'process';

// for dual extruder
export const LEFT_EXTRUDER = 'left';
export const RIGHT_EXTRUDER = 'right';
export const LEFT_EXTRUDER_MAP_NUMBER = '0';
export const RIGHT_EXTRUDER_MAP_NUMBER = '1';
export const BOTH_EXTRUDER_MAP_NUMBER = '2';

// for transformControl mode
export const ROTATE_MODE = 'rotate';
export const SCALE_MODE = 'scale';
export const TRANSLATE_MODE = 'translate';

// Stages for 3d print
export const STAGES_3DP = {
    noModel: 10,
    modelLoaded: 11,
    gcodeRendered: 12
};
// !important: keys in PRINTING_QUALITY_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_GROUP should change togethor

export const WHITE_COLOR = '#ffffff';
export const BLACK_COLOR = '#464646';

export const KEY_DEFAULT_CATEGORY_CUSTOM = 'key-default_category-Custom';

export const GCODE_VISIBILITY_TYPE = {
    'WALL-INNER': true,
    'WALL-OUTER': true,
    SKIN: true,
    SKIRT: true,
    SUPPORT: true,
    FILL: true,
    TRAVEL: false,
    UNKNOWN: true,
    TOOL0: true,
    TOOL1: true
};

export const GCODEPREVIEWMODES = [
    'Ordinary',
    'SingleLayer',
    'GrayUnderTheTopFloor'
];

export const GCODEPREVIEWMODES_ICONS = [
    'NormalMode',
    'SingleLayerMode',
    'GrayedOutMode'
];

export const PRINTING_MATERIAL_CONFIG_COLORS = [
    [WHITE_COLOR, BLACK_COLOR],
    ['#E70008', '#b36100', '#d4cc00', '#35a000', '#00685a', '#006a99', '#003c7c', '#4c2868', '#b3196f', '#767676'],
    ['#ff5257', '#ff8b00', '#fff500', '#7bf93c', '#00bea6', '#0092d3', '#0053aa', '#753fa0', '#f9239b', '#a6a6a6'],
    ['#ffd2d3', '#ffca8a', '#fbfb74', '#baff79', '#68d7c9', '#71cdec', '#7eadd8', '#bba4d3', '#ef9fd0', '#cccccc']
];

export const PRINTING_MATERIAL_CONFIG_KEYS_SINGLE = [
    // Color
    'color',
    // Temperature
    'material_diameter',
    'material_print_temperature',
    'material_final_print_temperature',
    'material_standby_temperature',
    'material_print_temperature_layer_0',
    'cool_fan_speed',
    'machine_heated_bed',
    'material_bed_temperature',
    'material_bed_temperature_layer_0',
    // Extrude
    'material_flow',
    // retraction
    'retraction_enable',
    'retract_at_layer_change',
    'retraction_amount',
    'retraction_speed',
    'retraction_hop_enabled',
    'retraction_hop'
];
export const PRINTING_MATERIAL_CONFIG_KEYS_DUAL = [
    // Color
    'color',
    // Temperature
    'material_diameter',
    'material_print_temperature',
    'material_final_print_temperature',
    'material_standby_temperature',
    'material_print_temperature_layer_0',
    'cool_fan_speed',
    'cool_fan_speed_0',
    'machine_heated_bed',
    'cool_fan_full_layer',
    'material_bed_temperature',
    'material_bed_temperature_layer_0',
    // Extrude
    'material_flow',
    // 'material_flow_layer_0',
    // retraction
    'retraction_enable',
    'retract_at_layer_change',
    'retraction_amount',
    'retraction_speed',
    'retraction_hop_enabled',
    'retraction_hop',
    'switch_extruder_retraction_amount'
];
export const PRINTING_QUALITY_CONFIG_KEYS_SINGLE = [
    'layer_height',
    'layer_height_0',
    'initial_layer_line_width_factor',
    'material_flow_layer_0',
    'wall_thickness',
    'top_thickness',
    'bottom_thickness',
    'outer_inset_first',
    'infill_sparse_density',
    'infill_pattern',
    // 'speed_print',
    'speed_print_layer_0',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_topbottom',
    'speed_travel',
    'speed_travel_layer_0',
    // 'Surface'
    'magic_spiralize',
    'magic_mesh_surface_mode',
    // 'HeatedBedAdhesionType'
    'adhesion_type',
    'skirt_line_count',
    'brim_line_count',
    'raft_margin',
    // 'Support'
    'support_enable',
    'support_type',
    'support_angle',
    'support_pattern',
    'support_infill_rate',
    'support_z_distance'
];
export const PRINTING_QUALITY_CONFIG_KEYS_DUAL = [
    'layer_height',
    'layer_height_0',
    'initial_layer_line_width_factor',
    'material_flow_layer_0',
    'wall_thickness',
    'top_thickness',
    'bottom_thickness',
    'outer_inset_first',
    'infill_sparse_density',
    'infill_pattern',
    // 'speed_print',
    'speed_print_layer_0',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_topbottom',
    'speed_travel',
    'speed_travel_layer_0',
    // 'Surface'
    'magic_spiralize',
    'magic_mesh_surface_mode',
    // 'HeatedBedAdhesionType'
    'adhesion_type',
    'skirt_line_count',
    'brim_line_count',
    'raft_margin',
    // 'Support'
    'support_enable',
    'support_type',
    'support_angle',
    'support_pattern',
    'support_infill_rate',
    'support_z_distance',
    // 'dual'
    'prime_tower_enable',
    'prime_tower_wipe_enabled',
    'ooze_shield_enabled',
    'ooze_shield_angle',
    'ooze_shield_dist'
    // 'switch_extruder_retraction_amount',
    // 'switch_extruder_retraction_speeds'
];
export const MACHINE_EXTRUDER_X = ['machine_extruder_start_pos_x', 'machine_extruder_end_pos_x'];
export const MACHINE_EXTRUDER_Y = ['machine_extruder_start_pos_y', 'machine_extruder_end_pos_y'];
export const PRINTING_MATERIAL_CONFIG_GROUP_SINGLE = [
    {
        name: 'Color',
        fields: [
            'color'
        ]
    },
    {
        name: 'key-printing/material_settings-Temperature',
        fields: [
            'material_diameter',
            'material_print_temperature',
            'material_final_print_temperature',
            'material_standby_temperature',
            'material_print_temperature_layer_0',
            'cool_fan_speed',
            'cool_fan_full_layer',
            'machine_heated_bed',
            'material_bed_temperature',
            'material_bed_temperature_layer_0'
        ]
    },
    {
        name: 'key-printing/material_settings-Extrusion',
        fields: [
            'material_flow',
            // 'material_flow_layer_0'
        ]
    },
    {
        name: 'Retract & Z Hop',
        fields: [
            'retraction_enable',
            'retract_at_layer_change',
            'retraction_amount',
            'retraction_speed',
            'retraction_hop_enabled',
            'retraction_hop'
        ]
    }
];
export const PRINTING_MATERIAL_CONFIG_GROUP_DUAL = [
    {
        name: 'Color',
        fields: [
            'color'
        ]
    },
    {
        name: 'key-printing/material_settings-Temperature',
        fields: [
            'material_diameter',
            'material_print_temperature',
            'material_final_print_temperature',
            'material_standby_temperature',
            'material_print_temperature_layer_0',
            'cool_fan_speed',
            'cool_fan_speed_0',
            'cool_fan_full_layer',
            'machine_heated_bed',
            'material_bed_temperature',
            'material_bed_temperature_layer_0'
        ]
    },
    {
        name: 'key-printing/material_settings-Extrusion',
        fields: [
            'material_flow',
            // 'material_flow_layer_0'
        ]
    },
    {
        name: 'Retract & Z Hop',
        fields: [
            'retraction_enable',
            'retract_at_layer_change',
            'retraction_amount',
            'switch_extruder_retraction_amount',
            'retraction_speed',
            'switch_extruder_retraction_speeds',
            'retraction_hop_enabled',
            'retraction_hop'
        ]
    }
];
export const PRINTING_QUALITY_CONFIG_GROUP_SINGLE = [
    {
        name: 'Quality',
        fields: [
            'layer_height',
            'layer_height_0',
            'initial_layer_line_width_factor',
            'material_flow_layer_0'
        ]
    },
    {
        name: 'Shell',
        fields: [
            'wall_thickness',
            'top_thickness',
            'bottom_thickness',
            'outer_inset_first'
        ]
    },
    {
        name: 'Infill',
        fields: [
            'infill_sparse_density',
            'infill_pattern'
        ]
    },
    {
        name: 'Speed',
        fields: [
            // 'speed_print',
            'speed_print_layer_0',
            'speed_infill',
            'speed_wall_0',
            'speed_wall_x',
            'speed_topbottom',
            'speed_travel',
            'speed_travel_layer_0'
        ]
    },
    {
        name: 'Surface',
        fields: [
            'magic_spiralize',
            'magic_mesh_surface_mode'
        ]
    },
    {
        name: 'Build Plate Adhesion Type',
        fields: [
            'adhesion_type',
            'skirt_line_count',
            'brim_line_count',
            'raft_margin'
        ]
    },
    {
        name: 'Support',
        fields: [
            'support_enable',
            'support_type',
            'support_pattern',
            'support_infill_rate',
            'support_z_distance',
            // 'support_xy_distance',
            // 'support_xy_overrides_z',
            'support_angle'
        ]
    }
];
export const PRINTING_QUALITY_CONFIG_GROUP_DUAL = [
    {
        name: 'Quality',
        fields: [
            'layer_height',
            'layer_height_0',
            'initial_layer_line_width_factor',
            'material_flow_layer_0'
        ]
    },
    {
        name: 'Shell',
        fields: [
            'wall_thickness',
            'top_thickness',
            'bottom_thickness',
            'outer_inset_first'
        ]
    },
    {
        name: 'Infill',
        fields: [
            'infill_sparse_density',
            'infill_pattern'
        ]
    },
    {
        name: 'Speed',
        fields: [
            // 'speed_print',
            'speed_print_layer_0',
            'speed_infill',
            'speed_wall_0',
            'speed_wall_x',
            'speed_topbottom',
            'speed_travel',
            'speed_travel_layer_0'
        ]
    },
    {
        name: 'Surface',
        fields: [
            'magic_spiralize',
            'magic_mesh_surface_mode'
        ]
    },
    {
        name: 'Build Plate Adhesion Type',
        fields: [
            'adhesion_type',
            'skirt_line_count',
            'brim_line_count',
            'raft_margin'
        ]
    },
    {
        name: 'Support',
        fields: [
            'support_enable',
            'support_type',
            'support_pattern',
            'support_infill_rate',
            'support_z_distance',
            // 'support_xy_distance',
            // 'support_xy_overrides_z',
            'support_angle'
        ]
    },
    {
        name: 'Dual Extrusion',
        fields: [
            'prime_tower_enable',
            'prime_tower_wipe_enabled',
            'ooze_shield_enabled',
            'ooze_shield_angle',
            'ooze_shield_dist'
            // 'switch_extruder_retraction_amount',
            // 'switch_extruder_retraction_speeds'
        ]
    }
];

export const PRINTING_QUALITY_CUSTOMIZE_FIELDS = [
    'layer_height',
    'infill_sparse_density',
    'wall_thickness',
    'adhesion_type',
    'support_enable'
];
export const PRINTING_QUALITY_CONFIG_INDEX = {
    'retraction_amount': 1,
    'retraction_speed': 1,
    'retraction_hop_enabled': 1,
    'retraction_hop': 2,
    'support_type': 1,
    'skirt_line_count': 1,
    'brim_line_count': 1,
    'raft_margin': 1
};
export const PRINTING_MANAGER_TYPE_MATERIAL = 'material';
export const PRINTING_MANAGER_TYPE_QUALITY = 'quality';

export const DEFAULT_CNC_CONFIG_IDS = [
    'tool.default_CVbit',
    'tool.default_FEM1.5',
    'tool.default_FEM3.175',
    'tool.default_MBEM',
    'tool.default_SGVbit',
    'tool.rAcrylic_FEM1.5',
    'tool.rEpoxy_SGVbit'
];

export const DEFAULT_LASER_CONFIG_IDS = [
    'present.default_CUT',
    'present.default_HDFill',
    'present.default_SDFill',
    'present.default_PathEngrave'
];

export const LASER_PRESENT_CONFIG_GROUP = [
    {
        name: 'key-Laser/ToolpathParameters-Method',
        fields: [
            'path_type'
        ]
    },
    {
        name: 'key-Laser/ToolpathParameters-Fill',
        fields: [
            'movement_mode',
            'direction',
            'fill_interval'
        ]
    },
    {
        name: 'key-Laser/ToolpathParameters-Speed',
        fields: [
            'jog_speed',
            'work_speed',
            'dwell_time'
        ]
    },
    {
        name: 'key-Laser/ToolpathParameters-Repetition',
        fields: [
            'multi_passes',
            'multi_pass_depth'
        ]
    },
    {
        name: 'key-Laser/ToolpathParameters-Power',
        fields: [
            'fixed_power'
        ]
    }
];

export const CNC_TOOL_CONFIG_GROUP = [
    {
        name: 'Carving Tool',
        fields: [
            'tool_type',
            'diameter',
            'angle',
            'shaft_diameter'
        ]
    },
    {
        name: 'Parameters',
        fields: [
            'jog_speed',
            'work_speed',
            'plunge_speed',
            'step_down',
            'step_over'
        ]
    }
];

export const CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION = {
    'allowance': {
        label: 'Allowance',
        description: 'Set the amount of the material remaining on the object that needs to be carved in future operations.',
        min: 0,
        step: 0.1,
        unit: 'mm',
        type: 'float',
        default_value: 0.1,
        value: 'allowance'
    },
    'sliceMode': {
        label: 'Method',
        description: 'Select the slicing mode of the mesh toolpath',
        type: 'enum',
        options: {
            'rotation': 'key-Cnc/ToolpathParameters-Rotation', // TODO
            'linkage': 'key-Cnc/ToolpathParameters-Linkage' // TODO
        },
        default_value: 'rotation'
    },
    'pathType': {
        label: 'Method',
        description: 'Set the processing method of the object.\n -On the Path: Carves along the shape of the object. \n -Outline: Carves along the outline of the object.\n -Fill: Carves away the inner area of the object.',
        type: 'enum',
        options: {
            'path': 'On the Path',
            'outline': 'Outline',
            'pocket': 'Fill'
        },
        default_value: 'path'
    },
    'targetDepth': {
        label: 'Target Depth',
        description: 'Set the depth of the object to be carved. The depth should be smaller than the flute length.',
        min: 0.01,
        step: 0.1,
        max: 100,
        value: 'targetDepth',
        default_value: 'targetDepth',
        type: 'float',
        unit: 'mm'
    },
    'safetyHeight': {
        label: 'Jog Height',
        description: 'Set the distance between the tool and the material when the tool is not carving.',
        min: 0.1,
        step: 1,
        max: 100,
        value: 'safetyHeight',
        default_value: 'safetyHeight',
        type: 'float',
        unit: 'mm'
    },
    'stopHeight': {
        label: 'Stop Height',
        description: 'Set the distance between the tool and the material when the tool stops.',
        min: 0.1,
        step: 0.1,
        max: 100,
        value: 'stopHeight',
        default_value: 'stopHeight',
        type: 'float',
        unit: 'mm'
    },
    'enableTab': {
        label: 'Use Tab',
        description: 'Use tabs to hold the pieces in place.',
        type: 'bool-switch', // bool type use switch component
        default_value: false,
        value: 'enableTab'
    },
    'tabHeight': {
        label: 'Tab Height',
        description: 'Set the height of tabs.',
        // min: '-targetDepth',
        max: 10,
        step: 0.1,
        value: 'tabHeight',
        default_value: 'tabHeight',
        type: 'float',
        unit: 'mm'
    },
    'tabSpace': {
        label: 'Tab Space',
        description: 'Set the distance between each tab.',
        min: 1,
        step: 1,
        value: 'tabSpace',
        default_value: 'tabSpace',
        type: 'float',
        unit: 'mm'
    },
    'tabWidth': {
        label: 'Tab Width',
        description: 'Set the width of tabs.',
        min: 1,
        step: 1,
        value: 'tabWidth',
        default_value: 'tabWidth',
        type: 'float',
        unit: 'mm'
    },
    'stepOver': {
        label: 'Stepover',
        description: 'Set the space between parallel toolpaths.',
        min: 0.01,
        step: 0.01,
        default_value: 0.25,
        value: 'step_over',
        type: 'float',
        unit: 'mm'
    },
    'workSpeed': {
        description: 'Set the speed at which the tool moves on the material when it is carving.',
        label: 'Work Speed',
        min: 0.01,
        step: 0.01,
        default_value: 0.25,
        value: 'step_over',
        unit: 'mm/min',
        type: 'float'
    },
    'plungeSpeed': {
        default_value: 300,
        type: 'float',
        min: 0.1,
        max: 1000,
        step: 0.01,
        label: 'Plunge Speed',
        unit: 'mm/min',
        description: 'Set the speed at which the tool is driven down into the material.'
    },
    'jogSpeed': {
        default_value: 1500,
        type: 'float',
        min: 1,
        max: 6000,
        step: 0.01,
        label: 'Jog Speed',
        unit: 'mm/min',
        description: 'Set the speed at which the tool moves on the material when it is not carving.'
    },
    'stepDown': {
        default_value: 0.5,
        type: 'float',
        min: 0.01,
        step: 0.01,
        label: 'Stepdown',
        description: 'Set the distance along the Z axis per step that the tool is plunged into the material.',
        unit: 'mm'
    }
};

export const LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION = {
    'pathType': {
        default_value: 'path',
        description: 'Set the processing method of the object. \n - Fill: Fills the object with lines or dots.\n - On the Path: Engraves along the shape of the object.',
        label: 'Method',
        type: 'enum',
        options: {
            'path': 'On the Path',
            'fill': 'Fill'
        }
    },
    'workSpeed': {
        label: 'Work Speed',
        description: 'Set the speed at which the toolhead moves on the material when it is engraving or cutting.',
        type: 'float',
        min: 1,
        max: 6000,
        step: 1,
        default_value: 'workSpeed',
        unit: 'mm/min'
    },
    'multiPasses': {
        label: 'Number of Passes',
        description: 'Set how many times the laser will trace the same path in a G-code file.',
        type: 'float',
        min: 1,
        max: 50,
        default_value: 'passes'
    },
    'multiPassDepth': {
        label: 'Z Step per Pass',
        description: 'Set the amount at which the Laser Module is lowered with each pass.',
        type: 'float',
        min: 0.01,
        max: 10,
        default_value: 'passDepth',
        unit: 'mm'
    },
    'fixedPower': {
        label: 'Laser Power',
        description: 'Set the laser power.',
        type: 'float',
        min: 0,
        max: 100,
        default_value: 'fixedPower',
        unit: '%'
    },
    'fixedPowerEnabled': {
        type: 'bool',
        default_value: true
    },
    'movementMode': {
        label: 'Movement Mode',
        description: 'Set whether the object is filled with lines or dots.',
        type: 'enum',
        options: {
            'greyscale-line': 'Line', // 'Line (Normal Quality)',
            'greyscale-dot': 'Dot' // 'Dot (High Quality)'
        },
        default_value: 'greyscale-line'
    },
    'fillInterval': {
        label: 'Fill Interval',
        description: 'Set the degree to which an area is filled with laser lines or dots. The minimal interval is 0.05 mm.',
        type: 'float',
        min: 0.05,
        // max: 1,
        step: 0.01,
        default_value: 0.25,
        value: 'fillInterval',
        unit: 'mm'
    },
    'fillDensity': {
        label: 'Fill Density',
        description: 'Set the precision at which an area is carved. The highest density is 0.05 mm (20 dot/mm). When it is set to 0, the SVG image will be carved without fill.',
        type: 'float',
        min: 1,
        max: 10,
        step: 1,
        default_value: 1,
        unit: 'dot/mm'
    },
    'density': {
        label: 'Density',
        description: 'Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.',
        type: 'float',
        min: 1,
        max: 10,
        step: 1,
        default_value: 'density',
        unit: 'dot/mm'
    },
    'dwellTime': {
        label: 'Dwell Time',
        description: 'Determines how long the laser keeps on when it’s engraving a dot.',
        type: 'float',
        min: 0.1,
        max: 1000,
        step: 0.1,
        default_value: 'dwellTime',
        value: 'dwellTime',
        unit: 'ms/dot'
    },
    'jogSpeed': {
        label: 'Jog Speed',
        description: 'Set the speed at which the toolhead moves on the material when it is not engraving or cutting.',
        min: 1,
        max: 6000,
        step: 1,
        type: 'float',
        unit: 'mm/min',
        default_value: 1500,
        value: 'jogSpeed'
    },
    'direction': {
        label: 'Line Direction',
        description: 'Set the direction of the engraved path. Engraves the path in a horizontal, vertical, or diagonal direction.',
        options: {
            Horizontal: 'Horizontal',
            Vertical: 'Vertical',
            Diagonal: 'Diagonal',
            Diagonal2: 'Diagonal2'
        },
        type: 'enum',
        default_value: 'direction',
        value: 'direction'
    }
};

const publicPath = global.PUBLIC_PATH || '';
export const DATA_PATH = `${publicPath}/data`;

export const DATA_PREFIX = `${publicPath}/data/Tmp`;

export const CNC_TOOL_SNAP_V_BIT = 'snap.v-bit';
export const CNC_TOOL_SNAP_V_BIT_CONFIG = { diameter: 0.2, angle: 30, shaftDiameter: 3.175 };
export const CNC_TOOL_SNAP_FLAT_END_MILL = 'snap.flat-end-mill';
export const CNC_TOOL_SNAP_FLAT_END_MILL_CONFIG = { diameter: 1.5, angle: 180, shaftDiameter: 1.5 };
export const CNC_TOOL_SNAP_BALL_END_MILL = 'snap.ball-end-mill';
export const CNC_TOOL_SNAP_BALL_END_MILL_CONFIG = { diameter: 3.175, angle: 180, shaftDiameter: 3.175 };
export const CNC_TOOL_SNAP_S_F_S = 'snap.straight-flute-sharp';
export const CNC_TOOL_SNAP_S_F_S_CONFIG = { diameter: 0.3, angle: 20, shaftDiameter: 3.715 };
export const CNC_TOOL_CUSTOM = 'custom';
export const CNC_TOOL_CUSTOM_CONFIG = { diameter: 0.1, angle: 180, shaftDiameter: 3.175 };

export const LASER_GCODE_SUFFIX = '.nc';
export const CNC_GCODE_SUFFIX = '.cnc';
export const PRINTING_GCODE_SUFFIX = '.gcode';

// Replacements for null value
export const ABSENT_VALUE = 896745231;
export const ABSENT_OBJECT = Object.freeze({});

// Experimental features
export const EXPERIMENTAL_WIFI_CONTROL = true;
export const EXPERIMENTAL_LASER_CAMERA = false;
export const EXPERIMENTAL_IMAGE_TRACING = false;
export const EXPERIMENTAL_IMAGE_TRACING_CNC = false;
export const EXPERIMENTAL_PROFILE = true;

export const PROTOCOL_TEXT = 'text';
export const PROTOCOL_SCREEN = 'screen';

export const MAX_LINE_POINTS = 300;
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 300;
export const SPEED_FACTOR_MIN = 0;
export const SPEED_FACTOR_MAX = 500;

export const HEAD_PRINTING = 'printing';
export const HEAD_LASER = 'laser';
export const HEAD_CNC = 'cnc';
export const HEAD_UNKNOWN = 'unknown';

export const CONNECTION_TYPE_SERIAL = 'serial';
export const CONNECTION_TYPE_WIFI = 'wifi';

export const LASER_PRINT_MODE_AUTO = 'auto';
export const LASER_PRINT_MODE_MANUAL = 'manual';

export const SELECTEVENT = {
    UNSELECT_ADDSELECT: 'select:unSelect-addSelect',
    UNSELECT: 'select:unSelect',
    ADDSELECT: 'select:addSelect',
    REMOVESELECT: 'select:removeSelect'
};

// todo: refactor this data structure
export const MACHINE_SERIES = {
    ORIGINAL: {
        value: 'Original',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
        setting: {
            size: {
                x: 125,
                y: 125,
                z: 125
            },
            laserSize: {
                x: 125,
                y: 125,
                z: 125
            }
        }
    },
    ORIGINAL_LZ: {
        value: 'Original Long Z-axis',
        configPath: 'Original',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module',
        setting: {
            size: {
                x: 125,
                y: 125,
                z: 221
            },
            laserSize: {
                x: 125,
                y: 125,
                z: 221
            }
        }
    },
    A150: {
        value: 'A150',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150',
        setting: {
            size: {
                x: 160,
                y: 160,
                z: 145
            },
            laserSize: {
                x: 167,
                y: 165,
                z: 150
            }
        },
        alias: ['SM2-S', 'Snapmaker 2.0 A150']
    },
    A250: {
        value: 'A250',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
        setting: {
            size: {
                x: 230,
                y: 250,
                z: 235
            },
            laserSize: {
                x: 252,
                y: 260,
                z: 235
            }
        },
        alias: ['SM2-M', 'Snapmaker 2.0 A250']

    },
    A350: {
        value: 'A350',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
        setting: {
            size: {
                x: 320,
                y: 350,
                z: 330
            },
            laserSize: {
                x: 345,
                y: 357,
                z: 334
            }
        },
        alias: ['SM2-L', 'Snapmaker 2.0 A350']
    },
    A400: {
        value: 'A400',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A400',
        setting: {
            size: {
                x: 400,
                y: 400,
                z: 400
            },
            laserSize: {
                x: 410,
                y: 410,
                z: 420
            }
        },
        alias: ['SM2-XL', 'Snapmaker 2.0 400']
    },
    CUSTOM: {
        value: 'Custom',
        label: 'key-Luban/Machine/MachineSeries-Custom',
        setting: {
            size: {
                x: 125,
                y: 125,
                z: 125
            },
            laserSize: {
                x: 125,
                y: 125,
                z: 125
            }
        },
        alias: ['Custom']
    }
};

export const SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL = 'singleExtruderToolheadForOriginal';
export const SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2 = 'singleExtruderToolheadForSM2';
export const DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 = 'dualExtruderToolheadForSM2';
export const LEVEL_ONE_POWER_LASER_FOR_ORIGINAL = 'levelOneLaserToolheadForOriginal';
export const LEVEL_TWO_POWER_LASER_FOR_ORIGINAL = 'levelTwoLaserToolheadForOriginal';
export const LEVEL_ONE_POWER_LASER_FOR_SM2 = 'levelOneLaserToolheadForSM2';
export const LEVEL_TWO_POWER_LASER_FOR_SM2 = 'levelTwoLaserToolheadForSM2';
export const STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL = 'standardCNCToolheadForOriginal';
export const STANDARD_CNC_TOOLHEAD_FOR_SM2 = 'standardCNCToolheadForSM2';
export const LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 = 'levelTwoCNCToolheadForSM2';

export const DUAL_EXTRUDER_LIMIT_WIDTH_L = 20;
export const DUAL_EXTRUDER_LIMIT_WIDTH_R = 20;

export const MACHINE_TOOL_HEADS = {
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL]: {
        platform: [MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value],
        value: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
        key: 'singleExtruderToolheadForOriginal',
        pathname: 'single',
        // label: SINGLE_EXTRUDER_TOOLHEAD,
        label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_ONE_POWER_LASER_FOR_ORIGINAL]: {
        platform: [MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value],
        value: LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
        label: 'key-App/Settings/MachineSettings-200mW Laser',
        pathname: '200mw',
        key: 'levelOneLaserToolheadForOriginal',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_TWO_POWER_LASER_FOR_ORIGINAL]: {
        platform: [MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value],
        value: LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,
        label: 'key-App/Settings/MachineSettings-1600mW Laser',
        pathname: '1600mw',
        key: 'levelTwoLaserToolheadForOriginal',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL]: {
        platform: [MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value],
        value: STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
        key: 'standardCNCToolheadForOriginal',
        label: 'key-App/Settings/MachineSettings-Standard CNC',
        pathname: 'standard',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]: {
        platform: [MACHINE_SERIES.A150.value, MACHINE_SERIES.A250.value, MACHINE_SERIES.A350.value, MACHINE_SERIES.A400.value],
        value: SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
        key: 'singleExtruderToolheadForSM2',
        pathname: 'single',
        // label: SINGL
        //
        //
        // E_EXTRUDER_TOOLHEAD,
        label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [DUAL_EXTRUDER_TOOLHEAD_FOR_SM2]: {
        platform: [MACHINE_SERIES.A150.value, MACHINE_SERIES.A250.value, MACHINE_SERIES.A350.value, MACHINE_SERIES.A400.value],
        value: DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
        pathname: 'dual',
        key: 'dualExtruderToolheadForSM2',
        label: 'key-App/Settings/MachineSettings-Dual Extruder Toolhead',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_ONE_POWER_LASER_FOR_SM2]: {
        platform: [MACHINE_SERIES.A150.value, MACHINE_SERIES.A250.value, MACHINE_SERIES.A350.value, MACHINE_SERIES.A400.value],
        value: LEVEL_ONE_POWER_LASER_FOR_SM2,
        pathname: '1600mw',
        key: 'levelOneLaserToolheadForSM2',
        label: 'key-App/Settings/MachineSettings-1600mW Laser',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_TWO_POWER_LASER_FOR_SM2]: {
        platform: [MACHINE_SERIES.A150.value, MACHINE_SERIES.A250.value, MACHINE_SERIES.A350.value, MACHINE_SERIES.A400.value],
        value: LEVEL_TWO_POWER_LASER_FOR_SM2,
        pathname: '10w',
        label: 'key-App/Settings/MachineSettings-10W Laser',
        key: 'levelTwoLaserToolheadForSM2',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [STANDARD_CNC_TOOLHEAD_FOR_SM2]: {
        platform: [MACHINE_SERIES.A150.value, MACHINE_SERIES.A250.value, MACHINE_SERIES.A350.value, MACHINE_SERIES.A400.value],
        value: STANDARD_CNC_TOOLHEAD_FOR_SM2,
        key: 'standardCNCToolheadForSM2',
        pathname: 'standard',
        label: 'key-App/Settings/MachineSettings-Standard CNC',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    }
};

export const MACHINE_HEAD_TYPE = {
    WORKSPACE: {
        value: 'workspace',
        label: 'key-machine_selection-Workspace'
    },
    '3DP': {
        value: '3dp',
        label: 'key-machine_selection-3D Printing',
        alias: ['3DP', '1']
    },
    LASER: {
        value: 'laser',
        label: 'key-machine_selection-Laser',
        alias: ['LASER', 'LASER350', 'LASER1600', '3']
    },
    '10W LASER': {
        value: '10w-laser',
        label: 'key-machine_selection-10W Laser',
        alias: ['10W LASER', '4']
    },
    CNC: {
        value: 'cnc',
        label: 'key-machine_selection-CNC',
        alias: ['CNC', '2']
    }
};

export const IMAGE_WIFI_CONNECTING = '/resources/images/connection/Screen.png';
export const IMAGE_WIFI_CONNECT_WAITING = '/resources/images/connection/ic_waiting-64x64.png';
export const IMAGE_WIFI_CONNECTED = '/resources/images/connection/ic_complete_64x64.png';
export const IMAGE_WIFI_ERROR = '/resources/images/connection/ic_error_64x64.png';
export const IMAGE_WIFI_WAITING = '/resources/images/connection/ic_WI-FI_64x64.png';
export const IMAGE_WIFI_WARNING = '/resources/images/ic_warning-64x64.png';
export const IMAGE_EMERGENCY_STOP = '/resources/images/connection/ic_emergency_stop.png';
export const HEAD_TYPE_ENV_NAME = {
    'printing': 'key-machine_selection-3D Printing',
    'laser': 'key-machine_selection-Laser',
    'cnc': 'key-machine_selection-CNC'
};
export const LASER_MOCK_PLATE_HEIGHT = 6;


// Model
export const SVG_NODE_NAME_TEXT = 'text';
export const SVG_NODE_NAME_IMAGE = 'image';

export const SOURCE_TYPE_3DP = '3dp';
export const SOURCE_TYPE_SVG = 'svg';
export const SOURCE_TYPE_TEXT = 'text';
export const SOURCE_TYPE_RASTER = 'raster';
export const SOURCE_TYPE_IMAGE3D = 'image3d';

export const PROCESS_MODE_BW = 'bw';
export const PROCESS_MODE_HALFTONE = 'halftone';
export const PROCESS_MODE_VECTOR = 'vector';
export const PROCESS_MODE_GREYSCALE = 'greyscale';
export const PROCESS_MODE_MESH = 'mesh';
export const PROCESS_MODES_EXCEPT_VECTOR = [
    PROCESS_MODE_BW,
    PROCESS_MODE_HALFTONE,
    PROCESS_MODE_GREYSCALE
];

export const PROCESS_MODE_ROTATION = 'rotation';
export const PROCESS_MODE_PLANE = 'plane';
export const PROCESS_MODE_4AXIS_LINKAGE = '4axisLinkage';

// 3D Mesh Convert 2D Image
export const FRONT = 'front';
export const BACK = 'back';
export const LEFT = 'left';
export const RIGHT = 'right';
export const TOP = 'top';
export const BOTTOM = 'bottom';

export const CNC_MESH_SLICE_MODE_ROTATION = 'rotation';
export const CNC_MESH_SLICE_MODE_LINKAGE = 'linkage';
export const CNC_MESH_SLICE_MODE_MULTI_DIRECTION = 'multi face';

export const TOOLPATH_TYPE_IMAGE = 'image';
export const TOOLPATH_TYPE_VECTOR = 'vector';
export const TOOLPATH_TYPE_SCULPT = 'sculpt';

export const DISPLAYED_TYPE_MODEL = 'model';
export const DISPLAYED_TYPE_TOOLPATH = 'toolpath';

// SVG Canvas coordinateMode
export const COORDINATE_MODE_CENTER = {
    label: 'key-CncLaser/JobSetup-Center',
    value: 'center',
    setting: {
        sizeMultiplyFactor: {
            x: 0,
            y: 0
        }
    }
};
export const COORDINATE_MODE_TOP_RIGHT = {
    label: 'key-CncLaser/JobSetup-Top Right',
    value: 'top-right',
    setting: {
        sizeMultiplyFactor: {
            x: -1,
            y: -1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_RIGHT = {
    label: 'key-CncLaser/JobSetup-Bottom Right',
    value: 'bottom-right',
    setting: {
        sizeMultiplyFactor: {
            x: -1,
            y: 1
        }
    }
};
export const COORDINATE_MODE_TOP_LEFT = {
    label: 'key-CncLaser/JobSetup-Top Left',
    value: 'top-left',
    setting: {
        sizeMultiplyFactor: {
            x: 1,
            y: -1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_LEFT = {
    label: 'key-CncLaser/JobSetup-Bottom Left',
    value: 'bottom-left',
    setting: {
        sizeMultiplyFactor: {
            x: 1,
            y: 1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_CENTER = {
    label: 'key-CncLaser/JobSetup-Top',
    value: 'bottom-center',
    setting: {
        sizeMultiplyFactor: {
            x: 0,
            y: 1
        }
    }
};
export function getCurrentHeadType(pathname) {
    if (!pathname) {
        return null;
    }
    let headType = null;
    if (pathname.indexOf(HEAD_CNC) >= 0) headType = HEAD_CNC;
    if (pathname.indexOf(HEAD_LASER) >= 0) headType = HEAD_LASER;
    if (pathname.indexOf(HEAD_PRINTING) >= 0) headType = HEAD_PRINTING;
    return headType;
}

export function getMachineSeriesWithToolhead(platform, toolhead) {
    const seriesInfo = valueOf(MACHINE_SERIES, 'value', platform) || MACHINE_SERIES.ORIGINAL;
    const size = seriesInfo ? seriesInfo.setting?.size : MACHINE_SERIES.ORIGINAL.setting.size;
    const workSize = {};
    const configPathname = {};
    Object.keys(toolhead).forEach(key => {
        const type = key.split('Toolhead')[0];
        const headToolInfo = MACHINE_TOOL_HEADS[toolhead[key]];
        workSize[type] = {
            x: size.x - headToolInfo.offset.x,
            y: size.y - headToolInfo.offset.y,
            z: size.z - headToolInfo.offset.z
        };
        configPathname[type] = `${platform === 'Original Long Z-axis' ? 'original' : platform.toLowerCase()}_${headToolInfo?.pathname}`;
    });
    return {
        series: platform,
        configPathname,
        workSize: workSize
    };
}

// Laser | CNC canvas min | max scale rate
export const VISUALIZER_CAMERA_HEIGHT = 300;
export const MAX_LASER_CNC_CANVAS_SCALE = 5;
export const MIN_LASER_CNC_CANVAS_SCALE = 0.5;
export const SOFTWARE_MANUAL = 'https://support.snapmaker.com/hc/en-us/articles/4406229926935';
export const FORUM_URL = 'https://forum.snapmaker.com/';
export const SUPPORT_ZH_URL = 'https://support.snapmaker.com/hc/zh-cn';
export const SUPPORT_EN_URL = 'https://support.snapmaker.com/hc/en-us';
export const TUTORIAL_VIDEO_URL = 'https://www.youtube.com/playlist?list=PLEn5aHQNSrHWvLWgQwrnLPY6VcaYnTvcQ';
export const OFFICIAL_SITE_ZH_URL = 'https://snapmaker.cn/';
export const OFFICIAL_SITE_EN_URL = 'https://snapmaker.com/';
export const MARKET_ZH_URL = 'https://snapmaker.world.tmall.com/?spm=a1z10.3-b.w5001-21696184167.3.40be7f386PAuCQ&scene=taobao_shop';
export const MARKET_EN_URL = 'https://shop.snapmaker.com/';
export const MYMINIFACTORY_URL = 'https://www.myminifactory.com/';

// Project and Menu
// once you change this number, make sure the number in `electron-app/Menu.js` also changed
export const MAX_RECENT_FILES_LENGTH = 12;

// Default toolHead for original
export const INITIAL_TOOL_HEAD_FOR_ORIGINAL = {
    printingToolhead: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
    laserToolhead: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
    cncToolhead: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value
};

export const INITIAL_TOOL_HEAD_FOR_SM2 = {
    printingToolhead: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
    laserToolhead: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
    cncToolhead: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value
};


export const LASER_10W_TAKE_PHOTO_POSITION = {
    A400: { // TODO: need to test
        x: 290,
        y: 210,
        z: 350
    },
    A350: {
        x: 232,
        y: 178,
        z: 290
    },
    A250: {
        x: 186,
        y: 130,
        z: 230
    },
    A150: {
        x: 155,
        y: 82,
        z: 150
    }
};

export const NOZZLE_SIZE_DEFAULT_OPTIONS = [
    { value: 0.2, label: '0.2' },
    { value: 0.4, label: '0.4' },
    { value: 0.6, label: '0.6' }
];

export const LOAD_MODEL_FROM_INNER = 0;
export const LOAD_MODEL_FROM_OUTER = 1;

export const longLang = ['de', 'es', 'fr', 'it', 'ru', 'uk', 'ja'];

export const longLangWithType = {
    'es': [HEAD_LASER, HEAD_CNC],
    'fr': [HEAD_LASER, HEAD_CNC],
    'it': [HEAD_LASER, HEAD_CNC],
    'ru': [HEAD_PRINTING, HEAD_LASER, HEAD_CNC]
};

export const SERIAL_MAP_SACP = {
    '0': 'A150',
    '1': 'A250',
    '2': 'A350',
    '3': 'A400'
};

export const PRINTING_MODULE = [0, 13];
export const LASER_MODULE = [2, 14];
export const CNC_MODULE = [1, 15];
export const EMERGENCY_STOP_BUTTON = [8, 517];
export const ENCLOSURE_MODULES = [5, 16];
export const ROTARY_MODULES = [6];
export const AIR_PURIFIER_MODULES = [7];
export const HEADT_BED_FOR_SM2 = 'heatBedForSM2';
export const A400_HEADT_BED_FOR_SM2 = 'a400HeatBedForSM2';
export const MODULEID_TOOLHEAD_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '512': HEADT_BED_FOR_SM2,
    '515': A400_HEADT_BED_FOR_SM2
};
