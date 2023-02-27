import { Machine, MachineType } from '../machine-definition';

/*
    {
        value: 'A400',
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
        size: {
            x: 400,
            y: 400,
            z: 400
        },
        alias: ['SM2-XL', 'Snapmaker 2.0 400'],
    },
*/

export const machine: Machine = {
    identifier: 'A400',

    fullName: 'Snapmaker Artisan',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A400.jpeg',

    metadata: {
        size: { x: 400, y: 400, z: 400 },

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A400',
    seriesLabelWithoutI18n: 'Artisan',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A400',
};
