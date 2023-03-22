import { Machine, MachineType } from '@snapmaker/luban-platform';

import {
    printToolHead,
    dualExtrusionPrintToolHead,
    standardLaserToolHead,
    highPower10WLaserToolHead,
    standardCNCToolHead,
} from './snapmaker-2-toolheads';

/*
    {
        value: 'A250',
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

        toolHeads: [
            {
                identifier: printToolHead.identifier,
                configPath: 'printing/a250_single',
            },
            {
                identifier: dualExtrusionPrintToolHead.identifier,
                configPath: 'printing/a250_dual',
                workRange: {
                    min: [0, 0, 0],
                    max: [230, 250, 210],
                },
            },
            {
                identifier: standardLaserToolHead.identifier,
                configPath: 'laser/a250_1600mw',
                workRange: {
                    min: [0, 0, 0],
                    max: [252, 260, 235],
                },
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a250_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [252, 260, 235], // TODO: check data
                },
            },
            {
                identifier: standardCNCToolHead.identifier,
                configPath: 'cnc/a250_standard',
            },
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A250',
    seriesLabelWithoutI18n: 'A250 A250T F250',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
};
