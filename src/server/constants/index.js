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

// 3D Mesh Convert 2D Image
export const FRONT = 'front';
export const BACK = 'back';
export const LEFT = 'left';
export const RIGHT = 'right';
export const TOP = 'top';
export const BOTTOM = 'bottom';

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
