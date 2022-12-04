import { includes } from 'lodash';

export const PRESET_CATEGORY_DEFAULT = 'Default';

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
        platform_adhesion: ['speed_layer_0', 'acceleration_layer_0'],
    };
}
