import { isUndefined } from 'lodash';
import { HEAD_PRINTING, MATERIAL_REGEX } from '../../constants';

// import { DEFAULE_PARAMS_FOR_TPU, DEFAULE_PARAMS_FOR_OTHERS, getPresetQuickParamsCalculated } from './preset-changes';
// import type { ParamsModelType } from './preset-changes';

// const OTHER_MATERISL_TYPES = ['pla', 'abs', 'petg'];

const DEFINITION_ROOT_KEYS = [
    'definitionId',
    'name',
    'i18nName',
    'isDefault',
    'isRecommended',
    'category',
    'inherits',
    'metadata',
    'settings',
    'overrides',
    'typeOfPrinting',
    'qualityType',

    'i18nCategory',
    'ownKeys',
];

declare interface SettingItem {
    // eslint-disable-next-line camelcase
    default_value: boolean | number | string;
}

// TODO: material category & quality category is not the same, distinguish them by subclasses
class PresetModel {
    // unique identifier for inner definition
    public definitionId = '';

    public headType = HEAD_PRINTING;
    // private params: ParamsModelType;
    public name = '';
    private inherits = '';
    public category = '';
    public i18nName = '';
    public i18nCategory = '';
    public settings: { [key: string]: SettingItem };
    public ownKeys: string[];

    // init definitionId and definition
    public constructor(definition: object) {
        Object.keys(definition)
            .forEach((key) => {
                if (!isUndefined(definition[key])) {
                    this[key] = definition[key];
                }
                if (!DEFINITION_ROOT_KEYS.includes(key)) {
                    console.warn('Unknown key', key);
                }
            });

        for (const key of DEFINITION_ROOT_KEYS) {
            if (!isUndefined(definition[key])) {
                this[key] = definition[key];
            }
        }

        // Assume that the materialType of material preset will never change
        if (MATERIAL_REGEX.test(this.definitionId)) {
            this.materialType = definition.settings.material_type.default_value;
        }
    }

    // public
    public getSerializableDefinition() {
        const {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            typeOfPrinting,
            ownKeys,
            settings,
        } = this;
        return {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            typeOfPrinting,
            ownKeys,
            settings
        };
    }
}

export default PresetModel;
