import type { Machine, MachineModule, MachineToolHeadOptions, ToolHead } from '@snapmaker/luban-platform';

import i18n from '../lib/i18n';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine
} from '../machines';
import {
    dualExtrusionPrintToolHead,
    highPower200WCNCToolHead as highPower200WCNCToolHeadSM2,
    highPower10WLaserToolHead as laser10WToolHeadSM2,
    printToolHead as printToolHeadSM2,
    standardCNCToolHead as standardCNCToolHeadSM2,
    standardLaserToolHead as standardLaserToolHeadSM2,
} from '../machines/snapmaker-2-toolheads';
import {
    printToolHead as printToolHeadJ1,
} from '../machines/snapmaker-j1';
import {
    cncToolHeadOriginal,
    laser1600mWToolHeadOriginal,
    laserToolHeadOriginal,
    printToolHeadOriginal
} from '../machines/snapmaker-original-toolheads';
import { quickSwapKitModule } from '../machines/snapmaker-2-modules';


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
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL]: printToolHeadOriginal,
    [LEVEL_ONE_POWER_LASER_FOR_ORIGINAL]: laserToolHeadOriginal,
    [LEVEL_TWO_POWER_LASER_FOR_ORIGINAL]: laser1600mWToolHeadOriginal,
    [STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL]: cncToolHeadOriginal,
    [SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]: printToolHeadSM2,
    [DUAL_EXTRUDER_TOOLHEAD_FOR_SM2]: dualExtrusionPrintToolHead,
    [LEVEL_ONE_POWER_LASER_FOR_SM2]: standardLaserToolHeadSM2,
    [LEVEL_TWO_POWER_LASER_FOR_SM2]: laser10WToolHeadSM2,
    [STANDARD_CNC_TOOLHEAD_FOR_SM2]: standardCNCToolHeadSM2,
    [highPower200WCNCToolHeadSM2.identifier]: highPower200WCNCToolHeadSM2,
    [printToolHeadJ1.identifier]: printToolHeadJ1,
};

// Module IDs
export const MODULEID_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '5': ENCLOSURE_FOR_SM2,
    '7': AIR_PURIFIER,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '16': ENCLOSURE_FOR_ARTISAN,
    '512': HEADT_BED_FOR_SM2,
    '513': SNAPMAKER_J1_HEATED_BED,
    '514': SNAPMAKER_J1_LINEAR_MODULE,
    '515': A400_HEADT_BED_FOR_SM2,
};

export const PRINTING_HEAD_MODULE_IDS = [
    0, // Extruder
    13, // Dual Extrusion Extruder
];

export const LASER_HEAD_MODULE_IDS = [
    2, // 1.6W Laser Module
    14, // 10W Laser Module
];
export const CNC_HEAD_MODULE_IDS = [
    1, // Standard CNC Module
    15, // High Power CNC Module
];
export const EMERGENCY_STOP_BUTTON = [8, 517];
export const ENCLOSURE_MODULES = [5, 16];
export const ROTARY_MODULES = [6];
export const AIR_PURIFIER_MODULES = [7];

export const MODULEID_TOOLHEAD_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '00': printToolHeadJ1.identifier,
};

export function findMachineByName(name: string): Machine | null {
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

export function findToolHead(identifier: string): ToolHead | null {
    for (const key of Object.keys(MACHINE_TOOL_HEADS)) {
        const toolHead = MACHINE_TOOL_HEADS[key];
        if (toolHead.identifier === identifier) {
            return toolHead;
        }
    }
    return null;
}

export function getMachineSupportedTools(machineSeries: string, headType = undefined): ToolHead[] {
    const machine: Machine | null = findMachineByName(machineSeries);
    if (!machine) {
        return [];
    }

    const toolHeads: ToolHead[] = [];
    for (const toolHeadOptions of machine.metadata.toolHeads) {
        for (const key of Object.keys(MACHINE_TOOL_HEADS)) {
            const toolHead = MACHINE_TOOL_HEADS[key];
            if (headType && toolHead.metadata?.headType !== headType) {
                continue;
            }
            if (toolHead.identifier === toolHeadOptions.identifier) {
                toolHeads.push(toolHead);
                break;
            }
        }
    }

    return toolHeads;
}

declare interface ToolOption {
    value: string;
    label: string;
    tool: ToolHead;
}

export function getMachineSupportedToolOptions(machineSeries, headType = undefined): ToolOption[] {
    const toolHeads = getMachineSupportedTools(machineSeries, headType);

    const options = [];
    for (const toolHead of toolHeads) {
        const option = {
            value: toolHead.value,
            label: i18n._(toolHead.label),
            tool: toolHead,
        };
        options.push(option);
    }

    return options;
}

export function isDualExtruder(identifier: string): boolean {
    /*
    if (includes([MACHINE_TOOL_HEADS['Snapmaker J1 IDEX Tool Head'].value, DUAL_EXTRUDER_TOOLHEAD_FOR_SM2], toolhead)) {
        return true;
    }
    */

    const tool = findToolHead(identifier);
    if (tool && tool.metadata.headType === HEAD_PRINTING) {
        return tool.metadata.numberOfExtruders === 2;
    }

    return false;
}

/**
 * Get work volume.
 *
 * Work volume is the visible wire frame.
 */
export function getWorkVolumeSize(machineIdentifier: string, toolHeadIdentifier: string): { x: number, y: number, z: number } {
    const machine = findMachineByName(machineIdentifier);
    const toolHead = findToolHead(toolHeadIdentifier);
    if (!machine || !toolHead) {
        return { x: 0, y: 0, z: 0 };
    }

    const toolHeadOptions = machine.metadata.toolHeads.find(toolHeadOption => toolHeadOption.identifier === toolHead.identifier);
    if (!toolHeadOptions) { // tool head not supported
        return { x: 0, y: 0, z: 0 };
    }

    if (toolHeadOptions.workRange) {
        return {
            x: machine.metadata.size.x,
            y: machine.metadata.size.y,
            z: toolHeadOptions.workRange.max[2],
        };
    } else {
        return machine.metadata.size;
    }
}

export function getMachineToolHeadConfigPath(machine: Machine, toolHeadIdentifier: string): string | null {
    const toolHeadOptions = machine.metadata.toolHeads
        .find(toolHeadOption => toolHeadOption.identifier === toolHeadIdentifier);
    if (!toolHeadOptions) {
        return null;
    }

    return toolHeadOptions.configPath || machine.identifier.toLowerCase();
}


/**
 * Get additional info about pair of <machine series, toolhead>.
 *
 * TODO: refactor this.
 *
 * @param series
 * @param toolhead
 */
export function getMachineSeriesWithToolhead(series: string, toolhead: { [key: string]: string }) {
    const machine: Machine | null = findMachineByName(series);
    if (!machine) {
        return {};
    }

    const size = machine.metadata.size;
    const workSize = {};
    const configPathname = {};

    Object.keys(toolhead).forEach((key: string) => {
        const identifier = toolhead[key];

        const type = key.split('Toolhead')[0];

        const toolHeadOptions = machine.metadata.toolHeads.find(toolHeadOption => toolHeadOption.identifier === identifier);
        if (!toolHeadOptions) {
            return;
        }

        if (toolHeadOptions.workRange) {
            workSize[type] = {
                x: toolHeadOptions.workRange.max[0],
                y: toolHeadOptions.workRange.max[1],
                z: toolHeadOptions.workRange.max[2],
            };
        } else {
            workSize[type] = {
                x: size.x,
                y: size.y,
                z: size.z,
            };
        }

        if (toolHeadOptions.configPath) {
            configPathname[type] = toolHeadOptions.configPath;
        } else {
            configPathname[type] = `${series.toLowerCase()}`;
        }
    });

    return {
        series,
        configPathname,
        workSize
    };
}


export function getMachineToolOptions(series: string, toolIdentifier: string): MachineToolHeadOptions | null {
    const machine: Machine | null = findMachineByName(series);

    const toolHeadOptions = machine.metadata.toolHeads.find(toolHeadOption => toolHeadOption.identifier === toolIdentifier);
    if (!toolHeadOptions) {
        return null;
    }

    return toolHeadOptions;
}

export function findMachineModule(identifier: string): MachineModule | null {
    const availableModules = [
        quickSwapKitModule,
    ];

    for (const module of availableModules) {
        if (module.identifier === identifier) {
            return module;
        }
    }

    return null;
}

export const SACP_TYPE_SERIES_MAP = {
    '0': 'A150',
    '1': 'A250',
    '2': 'A350',
    '3': 'A400',
    '4': MACHINE_SERIES.J1.identifier,
};

export default {};
