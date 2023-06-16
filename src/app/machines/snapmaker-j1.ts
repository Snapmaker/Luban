import type { Machine, ToolHead } from '@snapmaker/luban-platform';
import { MachineType, ToolHeadType, PrintMode } from '@snapmaker/luban-platform';


/**
 * J1 specific printing module.
 */
export const printToolHead: ToolHead = {
    identifier: 'Snapmaker J1 IDEX Tool Head',

    label: 'IDEX',
    image: '/resources/images/machine/snapmaker_j1_dual_extruders.png',

    metadata: {
        headType: ToolHeadType.Print,

        numberOfExtruders: 2,
    },

    value: 'Snapmaker J1 IDEX Tool Head',
};

export const machine: Machine = {
    identifier: 'Snapmaker J1',
    fullName: 'Snapmaker J1/J1s',
    img: '/resources/images/machine/snapmaker_j1.png',

    machineType: MachineType.Printer,

    metadata: {
        size: { x: 324, y: 200, z: 200 },

        toolHeads: [
            {
                identifier: printToolHead.identifier,
                configPath: 'printing/snapmaker_j1',
            }
        ],

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
        slicerVersion: 1,
    },

    // other attributes
    series: 'Snapmaker',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
    label: 'Snapmaker J1/J1s',
};
