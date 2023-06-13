import { Machine, MachineType } from '@snapmaker/luban-platform';

import { quickSwapKitModule } from './snapmaker-2-modules';
import {
    dualExtrusionPrintToolHead,
    highPower10WLaserToolHead,
    printToolHead,
    standardCNCToolHead,
    standardLaserToolHead,
} from './snapmaker-2-toolheads';

/*
    {
        value: 'A350',
        alias: ['SM2-L', 'Snapmaker 2.0 A350'],
    },
*/

export const machine: Machine = {
    identifier: 'A350',

    fullName: 'Snapmaker 2.0 A350/A350T/F350',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A350.jpg',

    metadata: {
        size: { x: 320, y: 350, z: 330 },

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
                    max: [320, 350, 290],
                },
            },
            {
                identifier: standardLaserToolHead.identifier,
                configPath: 'laser/a350_1600mw',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 334],
                },
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a350_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [345, 357, 334], // TODO: check data
                },
            },
            {
                identifier: standardCNCToolHead.identifier,
                configPath: 'cnc/a350_standard',
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
    seriesLabel: 'key-Luban/Machine/MachineSeries-A350',
    seriesLabelWithoutI18n: 'A350 A350T F350',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
};
