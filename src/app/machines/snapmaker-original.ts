import { Machine, MachineType } from '../machine-definition';

/*
    {
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
*/

export const machine: Machine = {
    identifier: 'Original',

    fullName: 'Snapmaker Original',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-1.0-original.jpg',

    metadata: {
        size: { x: 125, y: 125, z: 125 },

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker Original',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
    seriesLabelWithoutI18n: 'Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
};
