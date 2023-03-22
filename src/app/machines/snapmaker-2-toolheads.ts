import type { ToolHead } from '@snapmaker/luban-platform';
import { ToolHeadType } from '@snapmaker/luban-platform';

export const SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2 = 'singleExtruderToolheadForSM2';
export const DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 = 'dualExtruderToolheadForSM2';

export const LEVEL_ONE_POWER_LASER_FOR_SM2 = 'levelOneLaserToolheadForSM2';
export const LEVEL_TWO_POWER_LASER_FOR_SM2 = 'levelTwoLaserToolheadForSM2';

export const STANDARD_CNC_TOOLHEAD_FOR_SM2 = 'standardCNCToolheadForSM2';
export const LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2 = 'levelTwoCNCToolheadForSM2';

/**
 * 3D Printing Module for Snapmaker 2.0
 */
export const printToolHead: ToolHead = {
    identifier: SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
    image: '/resources/images/machine/tool-head-a-extruder.png',

    metadata: {
        headType: ToolHeadType.Print,

        numberOfExtruders: 1,
    },

    value: SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
};


/**
 * Dual Extrusion Printing Module for Snapmaker 2.0
 *
 * Snapmaker A-series & Artisan
 *
 * Detail: https://us.snapmaker.com/products/snapmaker-dual-extrusion-3d-printing-module
 */
export const dualExtrusionPrintToolHead: ToolHead = {
    identifier: DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-Dual Extruder Toolhead',
    image: '/resources/images/machine/tool-head-a-dual-extruder.png',

    metadata: {
        headType: ToolHeadType.Print,

        numberOfExtruders: 2,
    },

    value: DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
};

/**
 * Standard Laser Module for SM 2.0 (1600mW)
 */
export const standardLaserToolHead: ToolHead = {
    identifier: LEVEL_ONE_POWER_LASER_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-1600mW Laser',
    image: '/resources/images/machine/1600mw_laser.png',

    metadata: {
        headType: ToolHeadType.Laser,
    },

    value: LEVEL_ONE_POWER_LASER_FOR_SM2,
};

/**
 * 10W High Power Laser Module
 *
 * Detail: https://us.snapmaker.com/products/snapmaker-10w-high-power-laser-module
 */
export const highPower10WLaserToolHead: ToolHead = {
    identifier: LEVEL_TWO_POWER_LASER_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-10W Laser',
    image: '/resources/images/machine/10w_laser.png',

    metadata: {
        headType: ToolHeadType.Laser,
    },

    value: LEVEL_TWO_POWER_LASER_FOR_SM2,
};

/**
 * Standard CNC Module for SM 2.0
 */
export const standardCNCToolHead: ToolHead = {
    identifier: STANDARD_CNC_TOOLHEAD_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-Standard CNC',
    image: '/resources/images/machine/cnc_2.png',

    metadata: {
        headType: ToolHeadType.CNC,
    },

    value: STANDARD_CNC_TOOLHEAD_FOR_SM2,
};

/**
 * High Power CNC Module (200W)
 *
 * For Artisan only
 */
export const highPower200WCNCToolHead: ToolHead = {
    identifier: LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,

    label: 'key-App/Settings/MachineSettings-High CNC',
    image: '/resources/images/machine/coming_soon.png',

    metadata: {
        headType: ToolHeadType.CNC,
    },

    value: LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
};
