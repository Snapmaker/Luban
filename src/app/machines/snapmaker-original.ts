import type { Machine } from '../machine-definition';
import { MachineType } from '../machine-definition';
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
            },
            {
                identifier: laser1600mWToolHeadOriginal.identifier,
                configPath: 'laser/original_1600mw',
            },
            {
                identifier: cncToolHeadOriginal.identifier,
                configPath: 'cnc/original_standard',
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker Original',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Original',
    seriesLabelWithoutI18n: 'Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
};
