import { Machine, MachineType } from '../machine-definition';

/*
    {
        value: 'A350',
        alias: ['SM2-L', 'Snapmaker 2.0 A350'],
        setting: {
            laserSize: {
                x: 345,
                y: 357,
                z: 334
            }
        }
    },
*/

export const machine: Machine = {
    identifier: 'A350',

    fullName: 'Snapmaker 2.0 A350/A350T/F350',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A350.jpg',

    metadata: {
        size: { x: 320, y: 350, z: 330 },

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A350',
    seriesLabelWithoutI18n: 'A350 A350T F350',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
};
