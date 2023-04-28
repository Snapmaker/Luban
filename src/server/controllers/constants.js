// Marlin
export const MARLIN = 'Marlin';

export const QUERY_TYPE_POSITION = 'position';
export const QUERY_TYPE_ORIGIN_OFFSET = 'originOffset';
export const QUERY_TYPE_TEMPERATURE = 'temperature';
export const QUERY_TYPE_ENCLOSURE = 'enclosure';
export const QUERY_TYPE_PURIFIER = 'purifier';
export const QUERY_TYPE_EMERGEMCY_STOP = 'emergemcy_stop';

export const WRITE_SOURCE_CLIENT = 'client';
export const WRITE_SOURCE_FEEDER = 'feeder';
export const WRITE_SOURCE_SENDER = 'sender';
export const WRITE_SOURCE_QUERY = 'query';
export const WRITE_SOURCE_UNKNOWN = 'unknown';

export const HEAD_TYPE_3DP = '3DP';
export const HEAD_TYPE_PRINTING = 'printing';
export const HEAD_TYPE_LASER = 'LASER';
export const HEAD_TYPE_CNC = 'CNC';

export const PROTOCOL_TEXT = 'text';

export const GCODE_REQUEST_EVENT_ID = 0x01;
export const GCODE_RESPONSE_EVENT_ID = 0x02;
export const PRINT_GCODE_REQUEST_EVENT_ID = 0x03;
export const PRINT_GCODE_RESPONSE_EVENT_ID = 0x04;
export const FILE_OPERATION_REQUEST_EVENT_ID = 0x05;
export const FILE_OPERATION_RESPONSE_EVENT_ID = 0x06;
export const STATUS_SYNC_REQUEST_EVENT_ID = 0x07;
export const STATUS_RESPONSE_EVENT_ID = 0x08;
export const SETTINGS_REQUEST_EVENT_ID = 0x09;
export const SETTINGS_RESPONSE_EVENT_ID = 0x0a;
export const MOVEMENT_REQUEST_EVENT_ID = 0x0b;
export const MOVEMENT_RESPONSE_EVENT_ID = 0x0c;
export const LASER_CAMERA_OPERATION_REQUEST_EVENT_ID = 0x0d;
export const LASER_CAMERA_OPERATION_RESPONSE_EVENT_ID = 0x0e;
export const UPDATE_REQUEST_EVENT_ID = 0xa9;

export const HEAD_PRINTING = 'printing';
export const HEAD_LASER = 'laser';
export const HEAD_CNC = 'cnc';

export const LEVEL_ONE_POWER_LASER_FOR_ORIGINAL = 'levelOneLaserToolheadForOriginal';
export const LEVEL_TWO_POWER_LASER_FOR_ORIGINAL = 'levelTwoLaserToolheadForOriginal';
export const LEVEL_ONE_POWER_LASER_FOR_SM2 = 'levelOneLaserToolheadForSM2';
export const LEVEL_TWO_POWER_LASER_FOR_SM2 = 'levelTwoLaserToolheadForSM2';
export const STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL = 'standardCNCToolheadForOriginal';
export const STANDARD_CNC_TOOLHEAD_FOR_SM2 = 'standardCNCToolheadForSM2';
