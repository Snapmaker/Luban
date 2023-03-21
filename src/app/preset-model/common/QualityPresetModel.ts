import { isUndefined } from 'lodash';

import PresetModel from './PresetModel';


const QUALITY_SPECIFIC_KEYS = [
    'qualityType',
    'typeOfPrinting',
];

class QualityPresetModel extends PresetModel {
    public nozzleSize: number = 0.4;
    public qualityType: string = ''; // abs/tpu/other, TODO: refactor it
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
}

export default QualityPresetModel;
