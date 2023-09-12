import { Machine, MachineType } from '@snapmaker/luban-platform';

import { quickSwapKitModule } from './snapmaker-2-modules';
import {
    L20WLaserToolModule,
    L40WLaserToolModule,
    dualExtrusionPrintToolHead,
    highPower10WLaserToolHead,
    printToolHead,
    standardCNCToolHead,
    standardLaserToolHead,
} from './snapmaker-2-toolheads';

/*
    {
        value: 'A250',
        alias: ['SM2-M', 'Snapmaker 2.0 A250'],
    },
*/

export const machine: Machine = {
    identifier: 'Snapmaker 2.0 A250',

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
                supportCameraCapture: true,
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a250_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [252, 260, 235],
                },
                supportCameraCapture: true,
            },
            {
                identifier: L20WLaserToolModule.identifier,
                configPath: 'laser/a250_20w',
                workRange: {
                    min: [0, 0, 0],
                    max: [252, 260, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
            },
            {
                identifier: L40WLaserToolModule.identifier,
                configPath: 'laser/a250_40w',
                workRange: {
                    min: [0, 0, 0],
                    max: [252, 260, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
            },
            {
                identifier: standardCNCToolHead.identifier,
                configPath: 'cnc/a250_standard',
            },
        ],

        modules: [
            {
                identifier: quickSwapKitModule.identifier,
                workRangeOffset: [0, -15, 0],
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A250',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
};
