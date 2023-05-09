import { isUndefined } from 'lodash';
import { HEAD_PRINTING } from '../../constants';

// const OTHER_MATERISL_TYPES = ['pla', 'abs', 'petg'];

declare interface SettingItem {
    // eslint-disable-next-line camelcase
    default_value: boolean | number | string;
}

const PRESET_KEYS = [
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
    // 'typeOfPrinting',
    // 'qualityType',

    'i18nCategory',
    'ownKeys',
];

// TODO: material category & quality category is not the same, distinguish them by subclasses
class PresetModel {
    // unique identifier for inner definition
    public definitionId = '';

    public headType = HEAD_PRINTING;
    // private params: ParamsModelType;
    public name = '';
    protected inherits = '';
    public category = '';
    public i18nName = '';
    public i18nCategory = '';
    public metadata: { [key: string]: boolean | string | object };
    public settings: { [key: string]: SettingItem };
    public ownKeys: string[];

    // init definitionId and definition
    public constructor(definition: object) {
        // mirror keys
        for (const key of PRESET_KEYS) {
            if (!isUndefined(definition[key])) {
                this[key] = definition[key];
            }
        }

        // Assume that the materialType of material preset will never change
        // if (MATERIAL_REGEX.test(this.definitionId)) {
        //    this.materialType = definition.settings.material_type.default_value;
        // }
    }

    // public
    public getSerializableDefinition() {
        const {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            ownKeys,
            settings,
        } = this;

        return {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            ownKeys,
            settings,
        };
    }
}

export default PresetModel;
