import type { Machine } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';

import {
    laser1600mWToolHeadOriginal,
    laserToolHeadOriginal,
    printToolHeadOriginal,
    cncToolHeadOriginal
} from './snapmaker-original-toolheads';


export const DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS = 'Original Long Z-axis';
/**
 * Snapmaker Original with Z-axis Extension Module
 *
 * series: 'Snapmaker Original',
 * brand: 'Snapmaker'
 */
export const machine: Machine = {
    identifier: DEFAULT_MACHINE_ORIGINAL_LONG_Z_AXIS,

    fullName: 'Snapmaker Original with Z-axis Extension Module',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-1.0-original.jpg',

    metadata: {
        size: { x: 125, y: 125, z: 221 },

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
    seriesLabel: 'key-Workspace/MachineSetting-Z-Axis Extension Module',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module',
};
