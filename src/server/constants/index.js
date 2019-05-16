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
export const CURA_ENGINE_MACOS = '../CuraEngine/3.6/macOS/CuraEngine';
export const CURA_ENGINE_LINUX = '../CuraEngine/3.6/Linux/CuraEngine';
export const CURA_ENGINE_WIN64 = '../CuraEngine/3.6/Windows-x64/CuraEngine.exe';

export const CURA_ENGINE_CONFIG_LOCAL = '../CuraEngine/Config';
export const CURA_ENGINE_WIN = 'C:/ProgramData/Snapmakerjs/CuraEngine';
export const CURA_ENGINE_CONFIG_WIN = 'C:/ProgramData/Snapmakerjs/CuraEngine/Config';
export const FONTS_WIN = 'C:/ProgramData/Snapmakerjs/fonts';
export const SESSIONS_WIN = 'C:/ProgramData/Snapmakerjs/sessions';
export const DATA_WIN = 'C:/ProgramData/Snapmakerjs/data';
export const DATA_CACHE_WIN = 'C:/ProgramData/Snapmakerjs/data/_cache';
// export const SERVER_DATA_CACHE = '../app/images/_cache';
export const SERVER_DATA_CACHE = process.platform === 'win32' ? DATA_CACHE_WIN : '../app/data/_cache';
