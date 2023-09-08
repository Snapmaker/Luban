import { Machine } from '@snapmaker/luban-platform';
import { includes } from 'lodash';

import log from '../lib/log';
import { L20WLaserToolModule, L40WLaserToolModule } from '../machines/snapmaker-2-toolheads';
import type { QualityPresetModel } from '../preset-model';

// export const STACK_LEFT = 'left';
// export const STACK_RIGHT = 'right';

export const PRESET_CATEGORY_DEFAULT = 'Default';
export const PRESET_CATEGORY_CUSTOM = 'Custom';

// Preset Ids
// Preset Category = PRESET_CATEGORY_DEFAULT
export const DEFAULT_PRESET_IDS = [
    'quality.normal_quality',
    'quality.normal_other_quality',
    'quality.normal_tpu_quality',
    'quality.fast_print',
    'quality.high_quality',
    'quality.engineering_print'
];

export declare interface QualityPresetFilters {
    materialType: string;
    nozzleSize: number;
}

// TODO: Add to preset model.
export function isQualityPresetVisible(presetModel: QualityPresetModel, filters: QualityPresetFilters) {
    const { materialType = 'pla', nozzleSize = 0.4 } = filters;

    const regularMaterialTypes = ['pla', 'abs', 'petg'];

    let materialCheck = false;
    if (includes(regularMaterialTypes, materialType)) {
        materialCheck = presetModel.qualityType === 'abs';
    } else if (materialType === 'tpu') {
        materialCheck = presetModel.qualityType === 'tpu';
    } else {
        materialCheck = presetModel.qualityType === 'other';
    }

    if (!presetModel.qualityType) {
        log.warn(`Unknown qualityType for preset ${presetModel.definitionId}`);
        materialCheck = false;
    }

    if (!materialCheck) {
        return false;
    }

    // Check nozzle size
    if (presetModel.nozzleSize === nozzleSize) {
        return true;
    } else {
        return false;
    }
    /*
    if (presetModel.qualityType) {
        // check preset's qualityType matches materialType
        if (materialType === 'tpu') {
            return presetModel.qualityType === 'tpu';
        } else if (includes(regularMaterialTypes, materialType)) {
            return includes(regularMaterialTypes, presetModel.qualityType);
        } else {
            return presetModel.qualityType === 'other';
        }
    }

    return true;
    */
}


// These are options that can be set on right extruder
// TODO: Make it configurable
export function getQualityPresetLevelForRightExtruder() {
    return {
        quality: ['line_width'],
        printing_speed: ['speed_print', 'acceleration_enabled'],
        support: [
            'support_generate_type',
            'support_enable',
            'support_structure',
            'support_pattern',
            'support_infill_rate',
            'support_type',
            'support_angle',
            'support_distance',
        ],
        support_adv: [
            'support_interface_enable',
            'support_offset',
            'support_use_towers',
            'support_brim_enable',
            'support_fan_enable',
            'gradual_support_infill_steps',
            'gradual_support_infill_step_height',
            'support_infill_angles',
        ],
        platform_adhesion: ['speed_layer_0', 'acceleration_layer_0'],
    };
}

export interface THelperExtruderConfig {
    adhesion: string;
    support?: string;
}

export interface TSupportExtruderConfig {
    support: string; // support, including infill/first layer settings
    interface: string; // interface, including roof/bottom settings
}

export function getUsedExtruderNumber(
    limitKey: string, helpersExtruderConfig: THelperExtruderConfig, supportExtruderConfig: TSupportExtruderConfig
): string {
    switch (limitKey) {
        case 'adhesion_extruder_nr':
        case 'skirt_brim_extruder_nr':
        case 'raft_base_extruder_nr':
        case 'raft_interface_extruder_nr':
        case 'raft_surface_extruder_nr':
            return helpersExtruderConfig.adhesion;

        case 'support_extruder_nr':
        case 'support_infill_extruder_nr':
        case 'support_extruder_nr_layer_0':
            return supportExtruderConfig.support;

        case 'support_interface_extruder_nr':
        case 'support_roof_extruder_nr':
        case 'support_bottom_extruder_nr':
            return supportExtruderConfig.interface;

        default:
            return '-1';
    }
}

export interface LaserPresetGroup {
    name: string;
    fields: string[];
}

/**
 * Dirty method to generate laser preset groups for specific machine and tool head.
 */
export function getLaserPresetGroups(machine: Machine | null, toolHeadIdentifier: string): LaserPresetGroup[] {
    if (!machine) {
        return [];
    }

    // Check availability of tool head
    let avaialble = false;
    for (const toolHeadOptions of machine.metadata.toolHeads) {
        if (toolHeadOptions.identifier === toolHeadIdentifier) {
            avaialble = true;
            break;
        }
    }
    if (!avaialble) {
        return [];
    }

    const presetGroups = [];

    presetGroups.push({
        name: 'key-Laser/ToolpathParameters-Method',
        fields: ['path_type']
    });

    presetGroups.push({
        name: 'key-Laser/ToolpathParameters-Fill',
        fields: ['movement_mode', 'direction', 'fill_interval']
    });

    presetGroups.push({
        name: 'key-Laser/ToolpathParameters-Speed',
        fields: ['jog_speed', 'work_speed', 'dwell_time']
    });

    if (machine.metadata.size.z > 0) {
        presetGroups.push({
            name: 'key-Laser/ToolpathParameters-Repetition',
            fields: ['initial_height_offset', 'multi_passes', 'multi_pass_depth']
        });
    } else {
        // unable to move z
        presetGroups.push({
            name: 'key-Laser/ToolpathParameters-Repetition',
            fields: ['multi_passes']
        });
    }

    if (includes([L40WLaserToolModule.identifier], toolHeadIdentifier)) {
        // Half diode mode is only for 40W module
        presetGroups.push({
            name: 'key-Laser/ToolpathParameters-Power',
            fields: ['fixed_power', 'constant_power_mode', 'half_diode_mode']
        });
    } else {
        presetGroups.push({
            name: 'key-Laser/ToolpathParameters-Power',
            fields: ['fixed_power', 'constant_power_mode']
        });
    }

    // Remove auxiliary gas group if not using 20W module or 40W module
    if (includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolHeadIdentifier)) {
        presetGroups.push({
            name: 'key-Laser/ToolpathParameters-Auxiliary Gas',
            fields: ['auxiliary_air_pump']
        });
    }

    return presetGroups;
}
