import type { Machine } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';

import {
    laser1600mWToolHeadOriginal,
    laserToolHeadOriginal,
    printToolHeadOriginal,
    cncToolHeadOriginal
} from './snapmaker-original-toolheads';

/**
 * Snapmaker Original
 *
 * brand: 'Snapmaker'
 */
export const machine: Machine = {
    identifier: 'Original',

    fullName: 'Snapmaker Original',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-1.0-original.jpg',

    metadata: {
        size: { x: 125, y: 125, z: 125 },

        toolHeads: [
            {
                identifier: printToolHeadOriginal.identifier,
                configPath: 'printing/original_single',
            },
            {
                identifier: laserToolHeadOriginal.identifier,
                configPath: 'laser/original_200mw',
                goHomeOnConnection: false,
            },
            {
                identifier: laser1600mWToolHeadOriginal.identifier,
                configPath: 'laser/original_1600mw',
                goHomeOnConnection: false,
            },
            {
                identifier: cncToolHeadOriginal.identifier,
                configPath: 'cnc/original_standard',
                goHomeOnConnection: false,
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker Original',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
};
