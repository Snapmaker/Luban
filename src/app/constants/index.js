// Metric and Imperial units
export const IMPERIAL_UNITS = 'in';
export const METRIC_UNITS = 'mm';

export const EPSILON = 1e-6;

// Controller
export const MARLIN = 'Marlin';

// Workflow State
export const WORKFLOW_STATE_RUNNING = 'running';
export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

// Workflow status
export const WORKFLOW_STATUS_UNKNOWN = 'unknown';
export const WORKFLOW_STATUS_IDLE = 'idle';
export const WORKFLOW_STATUS_RUNNING = 'running';
export const WORKFLOW_STATUS_PAUSED = 'paused';

// Head Type
export const HEAD_TYPE_UNKNOWN = 'UNKNOWN';
export const HEAD_TYPE_3DP = '3DP';
export const HEAD_TYPE_LASER = 'LASER';
export const HEAD_TYPE_CNC = 'CNC';
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

// Stages for 3d print
export const STAGES_3DP = {
    noModel: 10,
    modelLoaded: 11,
    gcodeRendered: 12
};
// !important: keys in PRINTING_QUALITY_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_GROUP should change togethor
export const PRINTING_MATERIAL_CONFIG_KEYS = [
    'material_diameter',
    'material_flow',
    'material_print_temperature',
    'material_print_temperature_layer_0',
    'material_final_print_temperature',
    'cool_fan_speed',
    'machine_heated_bed',
    'material_bed_temperature',
    'material_bed_temperature_layer_0'
];
export const PRINTING_QUALITY_CONFIG_KEYS = [
    'layer_height',
    'layer_height_0',
    'initial_layer_line_width_factor',
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
    'retraction_enable',
    'retract_at_layer_change',
    'retraction_amount',
    'retraction_speed',
    'retraction_hop_enabled',
    'retraction_hop',
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
export const PRINTING_MATERIAL_CONFIG_GROUP = [
    {
        fields: [
            'material_diameter',
            'material_flow',
            'material_print_temperature',
            'material_print_temperature_layer_0',
            'material_final_print_temperature',
            'cool_fan_speed',
            'machine_heated_bed',
            'material_bed_temperature',
            'material_bed_temperature_layer_0'
        ]
    }
];
export const PRINTING_QUALITY_CONFIG_GROUP = [
    {
        name: 'Quality',
        fields: [
            'layer_height',
            'layer_height_0',
            'initial_layer_line_width_factor'
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
        name: 'Retraction & Z-hop',
        fields: [
            'retraction_enable',
            'retract_at_layer_change',
            'retraction_amount',
            'retraction_speed',
            'retraction_hop_enabled',
            'retraction_hop'
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
        name: 'Heated Bed Adhesion Type',
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

export const CNC_TOOL_CONFIG_GROUP = [
    {
        name: 'Carving Tool',
        fields: [
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
        description: 'Allowance',
        min: 0,
        step: 0.1,
        unit: 'mm',
        type: 'float',
        default_value: 0.1,
        value: 'allowance'
    },
    'sliceMode': {
        label: 'Slicing Mode',
        description: 'Select the slicing mode of the mesh toolpath',
        type: 'enum',
        options: {
            'rotation': 'Rotation',
            'linkage': 'Linkage'
        },
        default_value: 'rotation'
    },
    'pathType': {
        label: 'Path',
        description: 'Choose carving path',
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
        description: 'Enter the depth of the carved image. The depth cannot be deeper than the flute length.',
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
        description: 'The distance between the tool and the material when it’s not carving.',
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
        description: 'The distance between the tool and the material when the machine stops.',
        min: 0.1,
        step: 0.1,
        max: 100,
        value: 'stopHeight',
        default_value: 'stopHeight',
        type: 'float'
    },
    'enableTab': {
        label: 'Use Tab',
        description: 'Switch to use tab',
        type: 'bool',
        default_value: false,
        value: 'enableTab'
    },
    'tabHeight': {
        label: 'Tab Height',
        description: 'Enter the height of the tabs.',
        // min: '-targetDepth',
        max: 0,
        step: 0.5,
        value: 'tabHeight',
        default_value: 'tabHeight',
        type: 'float',
        unit: 'mm'
    },
    'tabSpace': {
        label: 'Tab Space',
        description: 'Enter the space between any two tabs.',
        min: 1,
        step: 1,
        value: 'tabSpace',
        default_value: 'tabSpace',
        type: 'float',
        unit: 'mm'
    },
    'tabWidth': {
        label: 'Tab Width',
        description: 'Enter the width of the tabs.',
        min: 1,
        step: 1,
        value: 'tabWidth',
        default_value: 'tabWidth',
        type: 'float',
        unit: 'mm'
    },
    'step_over': {
        label: 'Stepover',
        description: 'Set the space between parallel toolpaths.',
        min: 0.01,
        step: 0.01,
        default_value: 0.25,
        value: 'step_over',
        type: 'float'
    }
};

export const LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION = {
    'fillEnabled': {
        label: 'Method', // 'Fill'
        type: 'enum',
        default_value: 'false',
        options: {
            false: 'On the Path',
            true: 'Fill'
        }
    },
    'workSpeed': {
        label: 'Work Speed',
        description: 'Determines how fast the machine moves when it’s engraving.',
        type: 'float',
        min: 1,
        max: 6000,
        step: 1,
        default_value: 'workSpeed',
        unit: 'mm/min'
    },
    'multiPasses': {
        label: 'Number of Passes',
        description: 'Determines how many times the printer will run the G-code automatically.',
        type: 'float',
        min: 1,
        max: 50,
        default_value: 'passes'
    },
    'multiPassDepth': {
        label: 'Z Step per Pass',
        description: 'Determines how much the laser module will be lowered after each pass.',
        type: 'float',
        min: 0.01,
        max: 10,
        default_value: 'passDepth',
        unit: 'mm'
    },
    'fixedPower': {
        label: 'Laser Power',
        description: 'Power to use when laser is working.',
        type: 'float',
        min: 0,
        max: 100,
        default_value: 'fixedPower',
        unit: '%'
    },
    'movementMode': {
        label: 'Movement Mode',
        description: 'Choose Movement Mode',
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
        description: 'Determines how fast the machine moves when it’s not engraving.',
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
        description: 'Select the direction of the engraving path.',
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

export const HEAD_3DP = '3dp';
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
        label: 'Snapmaker Original',
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
        label: 'Snapmaker Original with Z-axis Extension Module ',
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
        label: 'Snapmaker 2.0 A150',
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
        label: 'Snapmaker 2.0 A250',
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
        label: 'Snapmaker 2.0 A350',
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
    CUSTOM: {
        value: 'Custom',
        label: 'Custom',
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

export const MACHINE_HEAD_TYPE = {
    WORKSPACE: {
        value: 'workspace',
        label: 'Workspace'
    },
    '3DP': {
        value: '3dp',
        label: '3D Printing',
        alias: ['3DP', '1']
    },
    LASER: {
        value: 'laser',
        label: 'Laser',
        alias: ['LASER', 'LASER350', 'LASER1600', '3']
    },
    CNC: {
        value: 'cnc',
        label: 'CNC',
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
    '3dp': '3D printing',
    'laser': 'Laser',
    'cnc': 'CNC'
};
export const LASER_MOCK_PLATE_HEIGHT = 6;


// Model
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
    label: 'Center',
    value: 'center',
    setting: {
        sizeMultiplyFactor: {
            x: 0,
            y: 0
        }
    }
};
export const COORDINATE_MODE_TOP_RIGHT = {
    label: 'Top-Right',
    value: 'top-right',
    setting: {
        sizeMultiplyFactor: {
            x: -1,
            y: -1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_RIGHT = {
    label: 'Bottom-Right',
    value: 'bottom-right',
    setting: {
        sizeMultiplyFactor: {
            x: -1,
            y: 1
        }
    }
};
export const COORDINATE_MODE_TOP_LEFT = {
    label: 'Top-Left',
    value: 'top-left',
    setting: {
        sizeMultiplyFactor: {
            x: 1,
            y: -1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_LEFT = {
    label: 'Bottom-Left',
    value: 'bottom-left',
    setting: {
        sizeMultiplyFactor: {
            x: 1,
            y: 1
        }
    }
};
export const COORDINATE_MODE_BOTTOM_CENTER = {
    label: 'Bottom-Center',
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
    if (pathname.indexOf(HEAD_3DP) >= 0) headType = HEAD_3DP;
    return headType;
}


// Laser | CNC canvas min | max scale rate
export const MAX_LASER_CNC_CANVAS_SCALE = 4;
export const MIN_LASER_CNC_CANVAS_SCALE = 0.5;
export const FORUM_URL = 'https://forum.snapmaker.com/';
export const SUPPORT_ZH_URL = 'https://support.snapmaker.com/hc/zh-cn';
export const SUPPORT_EN_URL = 'https://support.snapmaker.com/hc/en-us';
export const TUTORIAL_VIDEO_URL = 'https://www.youtube.com/c/Snapmaker/playlists';
export const OFFICIAL_SITE_ZH_URL = 'https://snapmaker.cn/';
export const OFFICIAL_SITE_EN_URL = 'https://snapmaker.com/';
export const MARKET_ZH_URL = 'https://snapmaker.world.tmall.com/?spm=a1z10.3-b.w5001-21696184167.3.40be7f386PAuCQ&scene=taobao_shop';
export const MARKET_EN_URL = 'https://shop.snapmaker.com/';
export const MYMINIFACTORY_URL = 'https://www.myminifactory.com/';

// Project and Menu
export const MAX_RECENT_FILES_LENGTH = 15;
