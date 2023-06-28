import type { ToolHead } from '@snapmaker/luban-platform';
import { ToolHeadType } from '@snapmaker/luban-platform';
// import i18n from '../lib/i18n';

export const SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL = 'singleExtruderToolheadForOriginal';
export const LEVEL_ONE_POWER_LASER_FOR_ORIGINAL = 'levelOneLaserToolheadForOriginal';
export const LEVEL_TWO_POWER_LASER_FOR_ORIGINAL = 'levelTwoLaserToolheadForOriginal';
export const STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL = 'standardCNCToolheadForOriginal';

export const printToolHeadOriginal: ToolHead = {
    identifier: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,

    // label: i18n._('key-App/Settings/MachineSettings-Single Extruder Toolhead'),
    label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
    image: '/resources/images/machine/original_3dp.png',

    platform: [],
    metadata: {
        headType: ToolHeadType.Print,

        numberOfExtruders: 1,
    },

    pathname: 'single',
};

// 200mW Laser
export const laserToolHeadOriginal: ToolHead = {
    identifier: LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,

    label: 'key-App/Settings/MachineSettings-200mW Laser',
    image: '/resources/images/machine/original_laser.png',

    platform: [],
    metadata: {
        headType: ToolHeadType.Laser,
    },

    pathname: '200mw',
};

// 1600mW Laser
export const laser1600mWToolHeadOriginal: ToolHead = {
    identifier: LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,

    label: 'key-App/Settings/MachineSettings-1600mW Laser',
    image: '/resources/images/machine/original_laser.png',

    platform: [],
    metadata: {
        headType: ToolHeadType.Laser,
    },

    pathname: '1600mw',
};

export const cncToolHeadOriginal: ToolHead = {
    identifier: STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,


    label: 'key-App/Settings/MachineSettings-Standard CNC',
    image: '/resources/images/machine/original_cnc.png',

    platform: [],
    metadata: {
        headType: ToolHeadType.CNC,
    },
};
