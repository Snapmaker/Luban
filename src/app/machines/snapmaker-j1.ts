import type { Machine } from '../machine-definition';
import { MachineType, PrintMode } from '../machine-definition';

const machine: Machine = {
    identifier: 'J1',
    fullName: 'Snapmaker J1',
    img: '/resources/images/machine/snapmaker_j1.png',

    machineType: MachineType.Printer,

    metadata: {
        size: [324, 200, 200],
        toolHeads: [],
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
    seriesLabelWithoutI18n: 'Snapmaker J1',
    label: 'Snapmaker J1',
};


export default machine;
