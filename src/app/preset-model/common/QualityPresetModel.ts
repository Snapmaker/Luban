import { isUndefined } from 'lodash';

import { QUALITY_REGEX } from '../../constants';

import PresetModel from './PresetModel';


const QUALITY_SPECIFIC_KEYS = [
    'qualityType',
    'typeOfPrinting',
];

class QualityPresetModel extends PresetModel {
    public nozzleSize: number = 0.4;
    public qualityType: string = ''; // abs/tpu/other, TODO: refactor it
    public typeOfPrinting = 'universal'; // universal/quik//fine/engineering

    public constructor(definition: object, defaultNozzleSize) {
        super(definition);

        this.__mirrorKeys(definition);

        if (QUALITY_REGEX.test(this.definitionId)) {
            this.updateParams(defaultNozzleSize);
        }

        this.nozzleSize = this.settings.machine_nozzle_size?.default_value as number;
    }

    private __mirrorKeys(definition: object): void {
        for (const key of QUALITY_SPECIFIC_KEYS) {
            if (!isUndefined(definition[key])) {
                this[key] = definition[key];
            }
        }
    }

    private updateParams(
        nozzleSize = this.nozzleSize,
    ) {
        console.log('updateParams', nozzleSize);
        // const settings = this.settings;
        /*
        nozzleSize = Number(nozzleSize);
        if ((materialType && materialType !== this.materialType) || (nozzleSize && nozzleSize !== this.nozzleSize)) {
            this.materialType = materialType;
            this.nozzleSize = nozzleSize;

            // todo change getting 'typeOfPrinting' from setting's param
            if (materialType === 'tpu' && nozzleSize === 0.4) {
                this.params = cloneDeep(DEFAULE_PARAMS_FOR_TPU);
            } else if (OTHER_MATERISL_TYPES.includes(materialType) && nozzleSize === 0.4) {
                this.params = cloneDeep(DEFAULE_PARAMS_FOR_OTHERS);
            } else {
                this.params = getPresetQuickParamsCalculated({ nozzleSize: this.nozzleSize });
            }
            console.info('this.params =', this.params);
        }
        */
    }
}

export default QualityPresetModel;
