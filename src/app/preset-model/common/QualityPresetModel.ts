import { QUALITY_REGEX } from '../../constants';

import PresetModel from './PresetModel';


class QualityPresetModel extends PresetModel {
    public nozzleSize: number = 0.4;
    public qualityType: string = 'abs'; // abs/tpu/other, TODO: refactor it
    public typeOfPrinting = 'universal'; // universal/quik//fine/engineering

    public constructor(definition: object, materialType, defaultNozzleSize) {
        super(definition);

        if (QUALITY_REGEX.test(this.definitionId)) {
            console.log('quality!');
            this.updateParams(materialType, defaultNozzleSize);
        }
    }

    private updateParams(
        materialType = this.materialType,
        nozzleSize = this.nozzleSize,
    ) {
        console.log('updateParams', materialType, nozzleSize);

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
