import includes from 'lodash/includes';
import { PrintMode } from './print-base';

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
export const ENCLOSURE_FOR_SM2 = 'enclosureForSM2';
export const ENCLOSURE_FOR_ARTISAN = 'enclosureForArtisan';
export const AIR_PURIFIER = 'airPurifier';

export const HEADT_BED_FOR_SM2 = 'heatBedForSM2';
export const A400_HEADT_BED_FOR_SM2 = 'a400HeatBedForSM2';

export const SNAPMAKER_J1_HEATED_BED = 'SnapmakerJ1:HeatedBed';
export const SNAPMAKER_J1_LINEAR_MODULE = 'SnapmakerJ1:LinearModule';

// Machine Types
export const MACHINE_TYPE_3D_PRINTER = '3D Printer';
export const MACHINE_TYPE_MULTI_FUNCTION_PRINTER = 'Multi-function 3D Printer';


export const DEFAULT_MACHINE_ORIGINAL = 'Original';
export const DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS = 'Original Long Z-axis';

// todo: refactor this data structure
export const MACHINE_SERIES = {
    ORIGINAL: {
        value: DEFAULT_MACHINE_ORIGINAL,
        fullName: 'Snapmaker Original',
        brand: 'Snapmaker',
        series: 'Snapmaker Original',
        seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
        seriesLabelWithoutI18n: 'Original',
        label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
        img: '/resources/images/machine/size-1.0-original.jpg',
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
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 125,
            y: 125,
            z: 125,
        },
        metadata: {
            slicerVersion: 0,
        },
    },
    ORIGINAL_LZ: {
        value: DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS,
        fullName: 'Snapmaker Original with Z-axis Extension Module',
        series: 'Snapmaker Original',
        seriesLabel: 'key-Workspace/MachineSetting-Z-Axis Extension Module',
        seriesLabelWithoutI18n: 'Original with Z-axis Extension Module',
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
        },
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 125,
            y: 125,
            z: 221,
        },
        img: '/resources/images/machine/size-1.0-original.jpg',
        metadata: {
            slicerVersion: 0,
        },
    },
    A150: {
        seriesLabel: 'key-Luban/Machine/MachineSeries-A150',
        seriesLabelWithoutI18n: 'A150',
        value: 'A150',
        fullName: 'Snapmaker 2.0 A150',
        series: 'Snapmaker 2.0',
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
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 160,
            y: 160,
            z: 145,
        },
        img: '/resources/images/machine/size-2.0-A150.png',
        alias: ['SM2-S', 'Snapmaker 2.0 A150'],
        metadata: {
            slicerVersion: 0,
        },
    },
    A250: {
        seriesLabel: 'key-Luban/Machine/MachineSeries-A250',
        seriesLabelWithoutI18n: 'A250 A250T F250',
        value: 'A250',
        fullName: 'Snapmaker 2.0 A250/A250T/F250',
        series: 'Snapmaker 2.0',
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
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 230,
            y: 250,
            z: 235,
        },
        img: '/resources/images/machine/size-2.0-A250.png',
        alias: ['SM2-M', 'Snapmaker 2.0 A250'],
        metadata: {
            slicerVersion: 0,
        },
    },
    A350: {
        seriesLabel: 'key-Luban/Machine/MachineSeries-A350',
        seriesLabelWithoutI18n: 'A350 A350T F350',
        value: 'A350',
        fullName: 'Snapmaker 2.0 A350/A350T/F350',
        series: 'Snapmaker 2.0',
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
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 320,
            y: 350,
            z: 330
        },
        img: '/resources/images/machine/size-2.0-A350.jpg',
        alias: ['SM2-L', 'Snapmaker 2.0 A350'],
        metadata: {
            slicerVersion: 0,
        },
    },
    A400: {
        value: 'A400',
        fullName: 'Snapmaker Artisan',
        series: 'Snapmaker',
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
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 400,
            y: 400,
            z: 400
        },
        img: '/resources/images/machine/size-2.0-A400.jpeg',
        alias: ['SM2-XL', 'Snapmaker 2.0 400'],
        metadata: {
            slicerVersion: 0,
        },
    },
    CUSTOM: {
        value: 'Custom',
        fullName: 'Custom 3D Printer',
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
    },
    J1: {
        value: 'Snapmaker J1',
        fullName: 'Snapmaker J1',
        series: 'Snapmaker',
        seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
        seriesLabelWithoutI18n: 'Snapmaker J1',
        label: 'Snapmaker J1',
        machineType: MACHINE_TYPE_3D_PRINTER,
        size: {
            x: 324,
            y: 200,
            z: 200
        },
        img: '/resources/images/machine/snapmaker_j1.png',
        configPath: 'snapmaker_j1',
        metadata: {
            slicerVersion: 1,
            printModes: [
                {
                    mode: PrintMode.Default,
                    workRange: {
                        min: [12, 0, 0],
                        max: [312, 200, 200],
                    },
                },
                {
                    mode: PrintMode.IDEXDuplication,
                    workRange: {
                        min: [0, 0, 0],
                        max: [160, 200, 200],
                    },
                },
                {
                    mode: PrintMode.IDEXMirror,
                    workRange: {
                        min: [0, 0, 0],
                        max: [150, 200, 200],
                    },
                },
                {
                    mode: PrintMode.IDEXBackup,
                    workRange: {
                        min: [12, 0, 0],
                        max: [312, 200, 200],
                    },
                },
            ],
        },
    }
};

export const HEAD_PRINTING = 'printing';
export const HEAD_LASER = 'laser';
export const HEAD_CNC = 'cnc';

export const MACHINE_TOOL_HEADS = {
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL]: {
        headType: HEAD_PRINTING,
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
        value: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
        key: 'singleExtruderToolheadForOriginal',
        pathname: 'single',
        // label: SINGLE_EXTRUDER_TOOLHEAD,
        label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
        image: '/resources/images/machine/original_3dp.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_ONE_POWER_LASER_FOR_ORIGINAL]: {
        headType: HEAD_LASER,
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
        value: LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
        label: 'key-App/Settings/MachineSettings-200mW Laser',
        pathname: '200mw',
        key: 'levelOneLaserToolheadForOriginal',
        image: '/resources/images/machine/original_laser.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_TWO_POWER_LASER_FOR_ORIGINAL]: {
        headType: HEAD_LASER,
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
        value: LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,
        label: 'key-App/Settings/MachineSettings-1600mW Laser',
        pathname: '1600mw',
        key: 'levelTwoLaserToolheadForOriginal',
        image: '/resources/images/machine/original_laser.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL]: {
        headType: HEAD_CNC,
        platform: [
            MACHINE_SERIES.ORIGINAL.value,
            MACHINE_SERIES.ORIGINAL_LZ.value
        ],
        value: STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
        key: 'standardCNCToolheadForOriginal',
        label: 'key-App/Settings/MachineSettings-Standard CNC',
        pathname: 'standard',
        image: '/resources/images/machine/original_cnc.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]: {
        headType: HEAD_PRINTING,
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
        image: '/resources/images/machine/printing_2.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [DUAL_EXTRUDER_TOOLHEAD_FOR_SM2]: {
        headType: HEAD_PRINTING,
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
        image: '/resources/images/machine/coming_soon.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_ONE_POWER_LASER_FOR_SM2]: {
        headType: HEAD_LASER,
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
        image: '/resources/images/machine/1600mw_laser.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_TWO_POWER_LASER_FOR_SM2]: {
        headType: HEAD_LASER,
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
        image: '/resources/images/machine/10w_laser.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [STANDARD_CNC_TOOLHEAD_FOR_SM2]: {
        headType: HEAD_CNC,
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
        image: '/resources/images/machine/cnc_2.png',
        // mock offset data
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    [LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2]: {
        headType: HEAD_CNC,
        platform: [MACHINE_SERIES.A400.value],
        value: LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
        key: 'levelTwoCNCToolheadForSM2',
        pathname: 'standard', // if have high power cnc profiles, should be update
        label: 'key-App/Settings/MachineSettings-High CNC',
        image: '/resources/images/machine/coming_soon.png',
        offset: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    'Snapmaker J1 IDEX Tool Head': {
        headType: HEAD_PRINTING,
        value: 'Snapmaker J1 IDEX Tool Head',
        label: 'IDEX',
        image: '/resources/images/machine/snapmaker_j1_dual_extruders.png',
        platform: [
            MACHINE_SERIES.J1.value,
        ],
        metadata: {
            numberOfExtruders: 2,
        }
    }
};

export const MODULEID_TOOLHEAD_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2
};

export const MODULEID_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '512': HEADT_BED_FOR_SM2,
    '513': SNAPMAKER_J1_HEATED_BED,
    '514': SNAPMAKER_J1_LINEAR_MODULE,
    '515': A400_HEADT_BED_FOR_SM2,
    '5': ENCLOSURE_FOR_SM2,
    '16': ENCLOSURE_FOR_ARTISAN,
    '7': AIR_PURIFIER
};

export function findMachineByName(name) {
    for (const key of Object.keys(MACHINE_SERIES)) {
        const machine = MACHINE_SERIES[key];
        if (machine.value === name) {
            return machine;
        }
    }
    return null;
}

function getMachineList() {
    const machineKeys = [
        MACHINE_SERIES.ORIGINAL.value,
        MACHINE_SERIES.ORIGINAL_LZ.value,
        MACHINE_SERIES.A150.value,
        MACHINE_SERIES.A250.value,
        MACHINE_SERIES.A350.value,
        MACHINE_SERIES.A400.value,
        MACHINE_SERIES.J1.value,
    ];

    const machines = [];
    for (const key of machineKeys) {
        const machine = findMachineByName(key);
        if (machine) {
            machines.push(machine);
        }
    }
    return machines;
}


export function getMachineOptions() {
    const machines = getMachineList();

    const options = [];
    for (const machine of machines) {
        const option = {
            value: machine.value, // unique key
            label: machine.label, // for i18n name display
            machine: machine, // reference of machine for further data fetch
        };
        options.push(option);
    }

    return options;
}

export function getMachineSupportedTools(machineSeries, headType = undefined) {
    const toolHeads = [];
    for (const key of Object.keys(MACHINE_TOOL_HEADS)) {
        const toolHead = MACHINE_TOOL_HEADS[key];

        if (toolHead.headType === undefined) {
            console.warn(`Unknown head type ${toolHead}`);
            continue;
        }

        if (headType !== undefined && toolHead.headType !== headType) {
            continue;
        }

        if (!includes(toolHead.platform, machineSeries)) {
            continue;
        }

        toolHeads.push(toolHead);
    }
    return toolHeads;
}

export function getMachineSupportedToolOptions(machineSeries, headType = undefined) {
    const toolHeads = getMachineSupportedTools(machineSeries, headType);

    const options = [];
    for (const toolHead of toolHeads) {
        const option = {
            value: toolHead.value,
            label: toolHead.label,
            tool: toolHead,
        };
        options.push(option);
    }

    return options;
}

export function isDualExtruder(toolhead: string): boolean {
    if (includes([MACHINE_TOOL_HEADS['Snapmaker J1 IDEX Tool Head'].value, DUAL_EXTRUDER_TOOLHEAD_FOR_SM2], toolhead)) {
        return true;
    }

    return false;
}

/**
 * Get additional info about pair of <machine series, toolhead>.
 *
 * TODO: refactor this.
 *
 * @param series
 * @param toolhead
 */
export function getMachineSeriesWithToolhead(series: string, toolhead: string) {
    const machine = findMachineByName(series);
    if (!machine) {
        return {};
    }

    const size = machine.size;
    const workSize = {};
    const configPathname = {};

    Object.keys(toolhead).forEach((key: string) => {
        const type = key.split('Toolhead')[0];
        const headToolInfo = MACHINE_TOOL_HEADS[toolhead[key]];
        workSize[type] = {
            x: size.x,
            y: size.y,
            z: size.z,
        };

        if (machine.configPath && machine.configPath) {
            configPathname[type] = machine.configPath;
        } else {
            configPathname[type] = `${series === MACHINE_SERIES.ORIGINAL_LZ.value
                ? 'original'
                : series.toLowerCase()
            }_${headToolInfo?.pathname}`;
        }
    });

    return {
        series,
        configPathname,
        workSize
    };
}

export const SACP_TYPE_SERIES_MAP = {
    '0': 'A150',
    '1': 'A250',
    '2': 'A350',
    '3': 'A400',
    '4': MACHINE_SERIES.J1.value,
};

export default {};
