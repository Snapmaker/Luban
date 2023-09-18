import type { Machine, MachineModule, MachineToolHeadOptions, ToolHead, ToolHeadType } from '@snapmaker/luban-platform';

import i18n from '../lib/i18n';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine,
    SnapmakerRayMachine
} from '../machines';
import { quickSwapKitModule } from '../machines/snapmaker-2-modules';
import {
    L20WLaserToolModule,
    L40WLaserToolModule,
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


export const DEFAULT_MACHINE_ORIGINAL = 'Original';
export const DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS = 'Original Long Z-axis';

// todo: refactor this data structure
export const MACHINE_SERIES = {
    ORIGINAL: SnapmakerOriginalMachine,
    ORIGINAL_LZ: SnapmakerOriginalExtendedMachine,
    [SnapmakerA150Machine.identifier]: SnapmakerA150Machine,
    [SnapmakerA250Machine.identifier]: SnapmakerA250Machine,
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
    [L20WLaserToolModule.identifier]: L20WLaserToolModule,
    [L40WLaserToolModule.identifier]: L40WLaserToolModule,
};

// Module IDs
export const MODULEID_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '5': ENCLOSURE_FOR_SM2,
    7: AIR_PURIFIER,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    '16': ENCLOSURE_FOR_ARTISAN,
    19: L20WLaserToolModule.identifier,
    20: L40WLaserToolModule.identifier,
    '512': HEADT_BED_FOR_SM2,
    '513': SNAPMAKER_J1_HEATED_BED,
    '514': SNAPMAKER_J1_LINEAR_MODULE,
    '515': A400_HEADT_BED_FOR_SM2,
    // 516: A400 Linear Module
    518: 'Snapmaker Ray - Enclosure',
    // 520: Ray Multi-Function Button
};

export const PRINTING_HEAD_MODULE_IDS = [
    0, // Extruder
    13, // Dual Extrusion Extruder
];

export const LASER_HEAD_MODULE_IDS = [
    2, // 1.6W Laser Module
    14, // 10W Laser Module
    19, // 20W Laser Module
    20, // 40W Laser Module
];
export const CNC_HEAD_MODULE_IDS = [
    1, // Standard CNC Module
    15, // High Power CNC Module
];
export const EMERGENCY_STOP_BUTTON = [8, 517];
export const ENCLOSURE_MODULE_IDS = [
    5, // Enclosure for SM 2.0
    16, // Enclosure for Artisan
    518, // Enclosure for Ray
];
export const ROTARY_MODULE_IDS = [
    6 // Rotary Module
];
export const AIR_PURIFIER_MODULE_IDS = [
    7, // Air Purifier
];

export const MODULEID_TOOLHEAD_MAP = {
    '0': SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    '1': STANDARD_CNC_TOOLHEAD_FOR_SM2,
    '2': LEVEL_ONE_POWER_LASER_FOR_SM2,
    '13': DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    '14': LEVEL_TWO_POWER_LASER_FOR_SM2,
    '15': LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    19: L20WLaserToolModule.identifier,
    20: L40WLaserToolModule.identifier,
    '00': printToolHeadJ1.identifier,
};

export function findMachineByName(identifier: string): Machine | null {
    const availableMachines = [
        SnapmakerOriginalMachine,
        SnapmakerOriginalExtendedMachine,
        SnapmakerA150Machine,
        SnapmakerA250Machine,
        SnapmakerA350Machine,
        SnapmakerArtisanMachine,
        SnapmakerJ1Machine,
        SnapmakerRayMachine,
    ];

    for (const machine of availableMachines) {
        if (machine.identifier === identifier) {
            return machine;
        }
    }
    return null;
}

function getMachineList() {
    const machineKeys = [
        SnapmakerOriginalMachine.identifier,
        SnapmakerOriginalExtendedMachine.identifier,
        SnapmakerA150Machine.identifier,
        SnapmakerA250Machine.identifier,
        SnapmakerA350Machine.identifier,
        SnapmakerArtisanMachine.identifier,
        SnapmakerJ1Machine.identifier,
        SnapmakerRayMachine.identifier,
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

type MachineOption = {
    value: string;
    label: string;
    machine: Machine;
}

export function getMachineOptions(): MachineOption[] {
    const machines = getMachineList();

    const options = [];
    for (const machine of machines) {
        const option = {
            value: machine.identifier, // unique key
            label: machine.fullName, // for i18n name display
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

export function getMachineSupportedTools(machineIdentifier: string, headType: ToolHeadType | null = null): ToolHead[] {
    const machine: Machine | null = findMachineByName(machineIdentifier);
    if (!machine) {
        return [];
    }

    const toolHeads: ToolHead[] = [];
    for (const toolHeadOptions of machine.metadata.toolHeads) {
        const tool = findToolHead(toolHeadOptions.identifier);
        if (tool) {
            if (headType && tool.metadata?.headType !== headType) {
                continue;
            }

            toolHeads.push(tool);
        }
    }

    return toolHeads;
}

declare interface ToolOption {
    value: string;
    label: string;
    tool: ToolHead;
}

export function getMachineSupportedToolOptions(machineSeries: string, headType = undefined): ToolOption[] {
    const toolHeads = getMachineSupportedTools(machineSeries, headType);

    const options = [];
    for (const toolHead of toolHeads) {
        const option = {
            value: toolHead.identifier,
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


export function getMachineToolOptions(machineIdentifier: string, toolIdentifier: string): MachineToolHeadOptions | null {
    const machine: Machine | null = findMachineByName(machineIdentifier);
    if (!machine) {
        return null;
    }

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
    '0': SnapmakerA150Machine.identifier,
    '1': SnapmakerA250Machine.identifier,
    '2': SnapmakerA350Machine.identifier,
    '3': SnapmakerArtisanMachine.identifier,
    '4': SnapmakerJ1Machine.identifier,
    '5': SnapmakerRayMachine.identifier,
};

// Baud rate to connect to the machines via serial port
export const DEFAULT_BAUDRATE = 115200;

export const LASER_10W_TAKE_PHOTO_POSITION = {
    [SnapmakerA150Machine.identifier]: {
        x: 155,
        y: 82,
        z: 150
    },
    [SnapmakerA250Machine.identifier]: {
        x: 186,
        y: 130,
        z: 230
    },
    [SnapmakerA350Machine.identifier]: {
        x: 232,
        y: 178,
        z: 290
    },
    [SnapmakerArtisanMachine.identifier]: {
        // TODO: need to test
        x: 265,
        y: 205,
        z: 330
    },
};

export const LASER_1600MW_CALIBRATION_POSITION = {
    [SnapmakerA150Machine.identifier]: {
        x: 155,
        y: 82,
        z: 150
    },
    [SnapmakerA250Machine.identifier]: {
        x: 186,
        y: 130,
        z: 230
    },
    [SnapmakerA350Machine.identifier]: {
        x: 192,
        y: 170,
        z: 170
    },
    [SnapmakerArtisanMachine.identifier]: {
        x: 265,
        y: 205,
        z: 330
    },
};


export default {};
