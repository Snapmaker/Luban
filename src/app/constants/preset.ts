import { includes } from 'lodash';

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

// TODO: Add to preset model.
export function isQualityPresetVisible(preset, { materialType = 'pla' }) {
    const regularMaterialTypes = ['pla', 'abs', 'petg'];
    if (preset.qualityType) {
        // check preset's qualityType matches materialType
        if (materialType === 'tpu') {
            return preset.qualityType === 'tpu';
        } else if (includes(regularMaterialTypes, materialType)) {
            return includes(regularMaterialTypes, preset.qualityType);
        } else {
            return preset.qualityType === 'other';
        }
    }

    return true;
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
            'support_infill_angles',
            'support_brim_enable',
            'support_offset',
            'support_interface_enable',
            'support_fan_enable',
            'gradual_support_infill_steps',
            'gradual_support_infill_step_height',
            'support_use_towers',
            'support_type',
            'support_angle',
            'support_distance',
        ],
        platform_adhesion: ['speed_layer_0', 'acceleration_layer_0'],
    };
}

interface ExtruderConfig {
    infill: string;
    shell: string;
    adhesion: string;
    support: string;
}

export function getUsedExtruderNumber(limitKey: string, extruderConfig: ExtruderConfig): string {
    switch (limitKey) {
        case 'adhesion_extruder_nr':
        case 'skirt_brim_extruder_nr':
        case 'raft_base_extruder_nr':
        case 'raft_interface_extruder_nr':
        case 'raft_surface_extruder_nr':
            return extruderConfig.adhesion;

        case 'support_extruder_nr':
        case 'support_interface_extruder_nr':
        case 'support_roof_extruder_nr':
        case 'support_bottom_extruder_nr':
        case 'support_infill_extruder_nr':
        case 'support_extruder_nr_layer_0':
            return extruderConfig.support;
        default:
            return '-1';
    }
}

