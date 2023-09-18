import type { Machine, } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';

import {
    L20WLaserToolModule,
    L40WLaserToolModule,
    dualExtrusionPrintToolHead,
    highPower10WLaserToolHead,
    highPower200WCNCToolHead,
} from './snapmaker-2-toolheads';


/*
    {
        value: 'A400',
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

        toolHeads: [
            {
                identifier: dualExtrusionPrintToolHead.identifier,
                configPath: 'printing/a400_dual',
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a400_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 420],
                },
                supportCameraCapture: true,
            },
            {
                identifier: L20WLaserToolModule.identifier,
                configPath: 'laser/a400_20w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
            },
            {
                identifier: L40WLaserToolModule.identifier,
                configPath: 'laser/a400_40w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
            },
            {
                identifier: highPower200WCNCToolHead.identifier,
                configPath: 'cnc/a400_standard',
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Snapmaker Artisan',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Artisan',
};
