import type { Machine } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';

import {
    dualExtrusionPrintToolHead,
    highPower10WLaserToolHead,
    printToolHead,
    standardLaserToolHead,
    standardCNCToolHead,
} from './snapmaker-2-toolheads';

/*
    {
        value: 'A150',
        alias: ['SM2-S', 'Snapmaker 2.0 A150'],
    },
*/

export const machine: Machine = {
    identifier: 'Snapmaker 2.0 A150',

    fullName: 'Snapmaker 2.0 A150',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A150.png',

    metadata: {
        size: { x: 160, y: 160, z: 145 },

        toolHeads: [
            {
                identifier: printToolHead.identifier,
                configPath: 'printing/a150_single',
            },
            {
                identifier: dualExtrusionPrintToolHead.identifier,
                configPath: 'printing/a150_dual',
                workRange: {
                    min: [0, 0, 0],
                    max: [160, 160, 110],
                },
            },
            {
                identifier: standardLaserToolHead.identifier,
                configPath: 'laser/a150_1600mw',
                workRange: {
                    min: [0, 0, 0],
                    max: [167, 165, 150],
                },
                supportCameraCapture: true,
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a150_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [167, 165, 120], // TODO: check data
                },
                supportCameraCapture: true,
            },
            {
                identifier: standardCNCToolHead.identifier,
                configPath: 'cnc/a150_standard',
            },
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A150',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150',
};
