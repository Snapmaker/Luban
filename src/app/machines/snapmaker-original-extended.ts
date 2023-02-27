import { Machine, MachineType } from '../machine-definition';

/*
    value: DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS,
        fullName: 'Snapmaker Original with Z-axis Extension Module',
        series: 'Snapmaker Original',
        seriesLabel: 'key-Workspace/MachineSetting-Z-Axis Extension Module',
        seriesLabelWithoutI18n: 'Original with Z-axis Extension Module',
        configPath: 'Original',
        label:
            'key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module',
        setting: {
            size: {
                x: 125,
                y: 125,
                z: 221
            },
            laserSize: {
                x: 125,
                y: 125,
                z: 221
            }
        },
        machineType: MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
        size: {
            x: 125,
            y: 125,
            z: 221,
        },
        img: '/resources/images/machine/size-1.0-original.jpg',
        metadata: {
            slicerVersion: 0,
        },
*/

const machine: Machine = {
    identifier: 'Original Long Z-axis',

    fullName: 'Snapmaker Original',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-1.0-original.jpg',

    metadata: {
        size: [125, 125, 221],

        toolHeads: [],

        slicerVersion: 0,
    },

    series: 'Snapmaker Original',
    seriesLabel: 'key-Workspace/MachineSetting-Z-Axis Extension Module',
    seriesLabelWithoutI18n: 'Original with Z-axis Extension Module',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module',
};

export default machine;
