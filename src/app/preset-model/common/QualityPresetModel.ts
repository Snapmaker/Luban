import { cloneDeep, isUndefined } from 'lodash';

import PresetModel from './PresetModel';


const QUALITY_SPECIFIC_KEYS = [
    'qualityType',
    'typeOfPrinting',
];

class QualityPresetModel extends PresetModel {
    public nozzleSize: number = 0.4;
    public qualityType: string = 'abs'; // abs/tpu/other, TODO: refactor it
    public typeOfPrinting = 'universal'; // universal/quik//fine/engineering

    public constructor(definition: object) {
        super(definition);

        this.__mirrorKeys(definition);

        this.nozzleSize = this.settings.machine_nozzle_size?.default_value as number;
    }

    private __mirrorKeys(definition: object): void {
        for (const key of QUALITY_SPECIFIC_KEYS) {
            if (!isUndefined(definition[key])) {
                this[key] = definition[key];
            }
        }
    }

    public getSerializableDefinition() {
        const {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            typeOfPrinting,
            qualityType,
            ownKeys,
            settings,
        } = this;

        return {
            definitionId,
            name,
            category,
            i18nCategory,
            inherits,
            qualityType,
            typeOfPrinting,
            ownKeys,
            settings
        };
    }

    public getRawData() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            category: this.category,
            inherits: this.inherits,
            ownKeys: this.ownKeys,
            metadata: this.metadata,
            qualityType: this.qualityType,
            typeOfPrinting: this.typeOfPrinting,
            settings: this.settings,
        };
    }

    public getSimplifiedData() {
        const data = {
            definitionId: this.definitionId,
            name: this.name,
            category: this.category,
            inherits: this.inherits,
            ownKeys: this.ownKeys,
            metadata: this.metadata,
            qualityType: this.qualityType,
            typeOfPrinting: this.typeOfPrinting,
            settings: {},
        };

        // simplify settings
        for (const key of this.ownKeys) {
            data.settings[key] = {
                default_value: this.settings[key].default_value,
            };
        }

        return data;
    }

    public clone() {
        const data = cloneDeep(this.getRawData());

        return new QualityPresetModel(data);
    }
}

export default QualityPresetModel;
