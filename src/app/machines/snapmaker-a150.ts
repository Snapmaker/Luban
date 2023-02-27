import { Machine, MachineType } from '../machine-definition';

/*
    {
        value: 'A150',
        setting: {
            laserSize: {
                x: 167,
                y: 165,
                z: 150
            }
        },
        alias: ['SM2-S', 'Snapmaker 2.0 A150'],
    },
*/

export const machine: Machine = {
    identifier: 'A150',

    fullName: 'Snapmaker 2.0 A150',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A150.png',

    metadata: {
        size: { x: 160, y: 160, z: 145 },

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A150',
    seriesLabelWithoutI18n: 'A150',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150',
};
