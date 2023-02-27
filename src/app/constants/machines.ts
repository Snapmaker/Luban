import includes from 'lodash/includes';
import {
    SnapmakerOriginalMachine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine
} from '../machines';

import log from '../lib/log';

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
    ORIGINAL: SnapmakerOriginalMachine,
    ORIGINAL_LZ: SnapmakerOriginalExtendedMachine,
    A150: SnapmakerA150Machine,
    A250: SnapmakerA250Machine,
    A350: SnapmakerA350Machine,
    A400: SnapmakerArtisanMachine,
    J1: SnapmakerJ1Machine,
};

export const HEAD_PRINTING = 'printing';
export const HEAD_LASER = 'laser';
export const HEAD_CNC = 'cnc';

export const MACHINE_TOOL_HEADS = {
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL]: {
        headType: HEAD_PRINTING,
        platform: [
            MACHINE_SERIES.ORIGINAL.identifier,
            MACHINE_SERIES.ORIGINAL_LZ.identifier,
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
            MACHINE_SERIES.ORIGINAL.identifier,
            MACHINE_SERIES.ORIGINAL_LZ.identifier,
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
            MACHINE_SERIES.ORIGINAL.identifier,
            MACHINE_SERIES.ORIGINAL_LZ.identifier,
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
            MACHINE_SERIES.ORIGINAL.identifier,
            MACHINE_SERIES.ORIGINAL_LZ.identifier,
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
            MACHINE_SERIES.A150.identifier,
            MACHINE_SERIES.A250.identifier,
            MACHINE_SERIES.A350.identifier,
        ],
        value: SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
        key: 'singleExtruderToolheadForSM2',
        pathname: 'single',
        // label: SINGL
        //
        //
        // E_EXTRUDER_TOOLHEAD,
        label: 'key-App/Settings/MachineSettings-Single Extruder Toolhead',
        image: '/resources/images/machine/tool-head-a-extruder.png',
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
            MACHINE_SERIES.A150.identifier,
            MACHINE_SERIES.A250.identifier,
            MACHINE_SERIES.A350.identifier,
            MACHINE_SERIES.A400.identifier,
        ],
        value: DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
        pathname: 'dual',
        key: 'dualExtruderToolheadForSM2',
        label: 'key-App/Settings/MachineSettings-Dual Extruder Toolhead',
        image: '/resources/images/machine/tool-head-a-dual-extruder.png',
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
            MACHINE_SERIES.A150.identifier,
            MACHINE_SERIES.A250.identifier,
            MACHINE_SERIES.A350.identifier,
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
            MACHINE_SERIES.A150.identifier,
            MACHINE_SERIES.A250.identifier,
            MACHINE_SERIES.A350.identifier,
            MACHINE_SERIES.A400.identifier,
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
            MACHINE_SERIES.A150.identifier,
            MACHINE_SERIES.A250.identifier,
            MACHINE_SERIES.A350.identifier,
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
        platform: [MACHINE_SERIES.A400.identifier],
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
            MACHINE_SERIES.J1.identifier,
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
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '00': MACHINE_TOOL_HEADS['Snapmaker J1 IDEX Tool Head'].value,
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
        if (machine.identifier === name) {
            return machine;
        }
    }
    return null;
}

function getMachineList() {
    const machineKeys = [
        MACHINE_SERIES.ORIGINAL.identifier,
        MACHINE_SERIES.ORIGINAL_LZ.identifier,
        MACHINE_SERIES.A150.identifier,
        MACHINE_SERIES.A250.identifier,
        MACHINE_SERIES.A350.identifier,
        MACHINE_SERIES.A400.identifier,
        MACHINE_SERIES.J1.identifier,
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
            value: machine.identifier, // unique key
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
            log.warn(`Unknown head type ${toolHead}`);
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

    const size = machine.metadata.size;
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
            configPathname[type] = `${series === MACHINE_SERIES.ORIGINAL_LZ.identifier
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
    '4': MACHINE_SERIES.J1.identifier,
};

export default {};
