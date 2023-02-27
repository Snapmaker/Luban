import { Machine, MachineType } from '../machine-definition';

/*
    {
        value: 'A250',
        setting: {
            laserSize: {
                x: 252,
                y: 260,
                z: 235
            }
        },
        alias: ['SM2-M', 'Snapmaker 2.0 A250'],
    },
*/

export const machine: Machine = {
    identifier: 'A250',

    fullName: 'Snapmaker 2.0 A250/A250T/F250',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A250.png',

    metadata: {
        size: { x: 230, y: 250, z: 235 },

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A250',
    seriesLabelWithoutI18n: 'A250 A250T F250',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
};
