import { Machine, MachineType } from '@snapmaker/luban-platform';

import { quickSwapKitModule, bracingKitModule, moduleCrosshair } from './snapmaker-2-modules';
import {
    L20WLaserToolModule,
    L2WLaserToolModule,
    L40WLaserToolModule,
    dualExtrusionPrintToolHead,
    highPower10WLaserToolHead,
    highPower200WCNCToolHead,
    printToolHead,
    standardCNCToolHead,
    standardLaserToolHead,
} from './snapmaker-2-toolheads';
import { JobOffsetMode } from '../constants/coordinate';

/*
    {
        value: 'A350',
        alias: ['SM2-L', 'Snapmaker 2.0 A350'],
    },
*/

export const machine: Machine = {
    identifier: 'Snapmaker 2.0 A350',

    fullName: 'Snapmaker 2.0 A350/A350T/F350',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A350.jpg',

    metadata: {
        size: { x: 320, y: 350, z: 325 },

        toolHeads: [
            {
                identifier: printToolHead.identifier,
                configPath: 'printing/a350_single',
            },
            {
                identifier: dualExtrusionPrintToolHead.identifier,
                configPath: 'printing/a350_dual',
                workRange: {
                    min: [0, 0, 0],
                    max: [320, 330, 285],
                },
            },
            {
                identifier: standardLaserToolHead.identifier,
                configPath: 'laser/a350_1600mw',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 334],
                },
                supportCameraCapture: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Laser Spot',
                        value: JobOffsetMode.LaserSpot,
                    },
                ]
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a350_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 334],
                },
                supportCameraCapture: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Laser Spot',
                        value: JobOffsetMode.LaserSpot,
                    },
                ]
            },
            {
                identifier: L20WLaserToolModule.identifier,
                configPath: 'laser/a350_20w',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
                runBoundaryModeOptions: [
                    // {
                    //     label: 'Laser Spot',
                    //     value: JobOffsetMode.LaserSpot,
                    // },
                ]
            },
            {
                identifier: L40WLaserToolModule.identifier,
                configPath: 'laser/a350_40w',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
                runBoundaryModeOptions: [
                    // {
                    //     label: 'Laser Spot',
                    //     value: JobOffsetMode.LaserSpot,
                    // },
                ]
            },
            {
                identifier: L2WLaserToolModule.identifier,
                configPath: 'laser/a350_2w', // 'laser/a350_2w',
                // workRange: {
                //     min: [0, 0, 0],
                //     max: [345, 357, 0], // Correct this later
                // },
                disableRemoteStartPrint: false,
                runBoundaryModeOptions: [
                    {
                        label: 'Crosshair',
                        value: JobOffsetMode.Crosshair,
                    }
                ]
            },
            {
                identifier: standardCNCToolHead.identifier,
                configPath: 'cnc/a350_standard',
            },
            {
                identifier: highPower200WCNCToolHead.identifier,
                configPath: 'cnc/200W',
            }
        ],

        modules: [
            {
                identifier: quickSwapKitModule.identifier,
                workRangeOffset: [0, -15, -15],
            },
            {
                identifier: bracingKitModule.identifier,
                workRangeOffset: [0, -12, -6],
            },
            {
                identifier: moduleCrosshair.identifier,
                moduleOriginOffset: [-21.6, 0.4, 0],
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker 2.0',
    seriesLabel: 'key-Luban/Machine/MachineSeries-A350',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
};
