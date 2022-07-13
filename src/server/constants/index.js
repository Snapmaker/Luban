// IP_WHITELIST
export const IP_WHITELIST = [
    // IPv4 reserved space
    '127.0.0.0/8', // Used for loopback addresses to the local host
    '10.0.0.0/8', // Used for local communications within a private network
    '172.16.0.0/12', // Used for local communications within a private network
    '192.168.0.0/16', // Used for local communications within a private network
    '169.254.0.0/16', // Link-local address

    // IPv4 mapped IPv6 address
    '::ffff:10.0.0.0/8',
    '::ffff:127.0.0.0/8',
    '::ffff:172.16.0.0/12',
    '::ffff:192.168.0.0/16',

    // IPv6 reserved space
    '::1/128', // loopback address to the local host
    'fc00::/7', // Unique local address
    'fe80::/10' // Link-local address
];
export const CONNECTION_MATERIALTHICKNESS_ABORT = 'connection:materialThickness_abort';
// Error Codes
export const ERR_BAD_REQUEST = 400;
export const ERR_UNAUTHORIZED = 401;
export const ERR_FORBIDDEN = 403;
export const ERR_NOT_FOUND = 404;
export const ERR_METHOD_NOT_ALLOWED = 405;
export const ERR_NOT_ACCEPTABLE = 406;
export const ERR_CONFLICT = 409;
export const ERR_LENGTH_REQUIRED = 411;
export const ERR_PRECONDITION_FAILED = 412;
export const ERR_PAYLOAD_TOO_LARGE = 413;
export const ERR_INTERNAL_SERVER_ERROR = 500;

// CuraEngine binaries
export const RESOURCES_DIR = '../resources';

export const CURA_ENGINE_MACOS = `${RESOURCES_DIR}/CuraEngine/3.6/macOS/CuraEngine`;
export const CURA_ENGINE_LINUX = `${RESOURCES_DIR}/CuraEngine/3.6/Linux/CuraEngine`;
export const CURA_ENGINE_WIN64 = `${RESOURCES_DIR}/CuraEngine/3.6/Windows-x64/CuraEngine.exe`;


export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

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
        label: 'key-Luban/Machine/MachineSeries-Snapmaker A400',
        setting: {
            size: {
                x: 400,
                y: 400,
                z: 400
            },
            laserSize: {
                x: 400,
                y: 400,
                z: 400
            }
        },
        alias: ['SM2-L', 'Snapmaker A400']
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

// 3D Mesh Convert 2D Image
export const FRONT = 'front';
export const BACK = 'back';
export const LEFT = 'left';
export const RIGHT = 'right';
export const TOP = 'top';
export const BOTTOM = 'bottom';

// Connection Type
export const CONNECTION_TYPE_SERIAL = 'serial';
export const CONNECTION_TYPE_WIFI = 'wifi';

// Head Type
export const HEAD_CNC = 'cnc';
export const HEAD_LASER = 'laser';
export const HEAD_PRINTING = 'printing';

// Model
export const SOURCE_TYPE_3DP = '3dp';
export const SOURCE_TYPE_SVG = 'svg';
export const SOURCE_TYPE_TEXT = 'text';
export const SOURCE_TYPE_RASTER = 'raster';
export const SOURCE_TYPE_IMAGE3D = 'image3d';

export const PROCESS_MODE_BW = 'bw';
export const PROCESS_MODE_VECTOR = 'vector';
export const PROCESS_MODE_HALFTONE = 'halftone';
export const PROCESS_MODE_GREYSCALE = 'greyscale';
export const PROCESS_MODE_MESH = 'mesh';

export const ConfigV1Regex = /([A-Za-z0-9_]+)\.def\.json$/;
export const ConfigV2Regex = /([A-Za-z0-9_]+)\.defv2\.json$/;
export const CncSuffix = '.defv2.json';
export const ConfigV1Suffix = '.def.json';
export const ConfigV2Suffix = '.defv2.json';
export const CNC_CONFIG_SUBCATEGORY = 'cnc';
export const LASER_CONFIG_SUBCATEGORY = 'laser';
export const PRINTING_CONFIG_SUBCATEGORY = 'printing';
// Use a special a value to expand the range of pixels in the picture
// 255 -> 0 => 255 ->0 -> -255
export const CNC_IMAGE_NEGATIVE_RANGE_FIELD = 254;

export const CNC_MESH_SLICE_MODE_ROTATION = 'rotation';
export const CNC_MESH_SLICE_MODE_LINKAGE = 'linkage';
export const CNC_MESH_SLICE_MODE_MULTI_DIRECTION = 'multi face';

export const TOOLPATH_TYPE_IMAGE = 'image';
export const TOOLPATH_TYPE_VECTOR = 'vector';
export const TOOLPATH_TYPE_SCULPT = 'sculpt';
export const EPS = 1e-6;

export const DEFINITION_SNAPMAKER_EXTRUDER_0 = 'snapmaker_extruder_0';
export const DEFINITION_SNAPMAKER_EXTRUDER_1 = 'snapmaker_extruder_1';
export const DEFINITION_ACTIVE = 'active';
export const DEFINITION_ACTIVE_FINAL = 'active_final';

export const KEY_DEFAULT_CATEGORY_CUSTOM = 'key-default_category-Custom';
export const KEY_DEFAULT_CATEGORY_DEFAULT = 'key-default_category-Default';

export const PORT_SCREEN_HTTP = 8080;
export const PORT_SCREEN_SACP = 8888;
export const SACP_PROTOCOL = 'SACP';

export const MINIMUM_WIDTH_AND_HEIGHT = 0.01;
