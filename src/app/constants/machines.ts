
const machineList = [{
    value: 'Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
    image: '/resources/images/machine/size-1.0-original.jpg',
}, {
    value: 'A150',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150',
    image: '/resources/images/machine/size-2.0-A150.png'
}, {
    value: 'A250',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
    image: '/resources/images/machine/size-2.0-A250.png'
}, {
    value: 'A350',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
    image: '/resources/images/machine/size-2.0-A350.jpg'
}, {
    value: 'A400',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A400',
    image: '/resources/images/machine/size-2.0-A400.jpeg'
}];


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
export const DUAL_EXTRUDER_LIMIT_WIDTH_L = 0;
export const DUAL_EXTRUDER_LIMIT_WIDTH_R = 0;

// todo: refactor this data structure
export const MACHINE_SERIES = {
    ORIGINAL: {
        seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
        seriesLabelWithoutI18n: 'Original',
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
        seriesLabel: 'key-Workspace/MachineSetting-Z-Axis Extension Module',
        seriesLabelWithoutI18n: 'Original with Z-axis Extension Module',
        value: 'Original Long Z-axis',
        configPath: 'Original',
        label:
            'key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module',
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
        seriesLabel: 'key-Luban/Machine/MachineSeries-A150',
        seriesLabelWithoutI18n: 'A150',
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
        seriesLabel: 'key-Luban/Machine/MachineSeries-A250',
        seriesLabelWithoutI18n: 'A250 A250T F250',
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
        seriesLabel: 'key-Luban/Machine/MachineSeries-A350',
        seriesLabelWithoutI18n: 'A350 A350T F350',
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
        seriesLabel: 'key-Luban/Machine/MachineSeries-A400',
        seriesLabelWithoutI18n: 'Artisan',
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
        seriesLabel: 'Custom',
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
export const MACHINE_TOOL_HEADS = {
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL]: {
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
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
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
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
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
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
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
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
        platform: [
            MACHINE_SERIES.A150.value,
            MACHINE_SERIES.A250.value,
            MACHINE_SERIES.A350.value,
            MACHINE_SERIES.A400.value
        ],
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
        platform: [
            MACHINE_SERIES.A150.value,
            MACHINE_SERIES.A250.value,
            MACHINE_SERIES.A350.value,
            MACHINE_SERIES.A400.value
        ],
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
        platform: [
            MACHINE_SERIES.A150.value,
            MACHINE_SERIES.A250.value,
            MACHINE_SERIES.A350.value,
            MACHINE_SERIES.A400.value
        ],
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
        platform: [
            MACHINE_SERIES.A150.value,
            MACHINE_SERIES.A250.value,
            MACHINE_SERIES.A350.value,
            MACHINE_SERIES.A400.value
        ],
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
        platform: [
            MACHINE_SERIES.A150.value,
            MACHINE_SERIES.A250.value,
            MACHINE_SERIES.A350.value,
            MACHINE_SERIES.A400.value
        ],
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
    },
    [LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2]: {
        platform: [MACHINE_SERIES.A400.value],
        value: LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
        key: 'levelTwoCNCToolheadForSM2',
        pathname: 'standard', // if have high power cnc profiles, should be update
        label: 'key-App/Settings/MachineSettings-High CNC',
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    }
};
export const HEAD_PRINTING = 'printing';
export const HEAD_LASER = 'laser';
export const HEAD_CNC = 'cnc';
export const HEAD_UNKNOWN = 'unknown';
const toolHeadMap = {
    [MACHINE_SERIES.ORIGINAL.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_3dp.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_cnc.png'
        }]
    },
    [MACHINE_SERIES.ORIGINAL_LZ.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_3dp.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_cnc.png'
        }]
    },
    [MACHINE_SERIES.A150.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A250.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A350.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A400.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }]
    },
};


export function getMachineList() {
    return machineList;
}

export function getToolHeadMap() {
    return toolHeadMap;
}


// export default {};
