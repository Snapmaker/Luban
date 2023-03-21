
import { MATERIAL_REGEX } from '../../constants';

import PresetModel from './PresetModel';



class MaterialPresetModel extends PresetModel {
    public materialType: string = 'pla';

    public constructor(definition: object) {
        super(definition);

        if (MATERIAL_REGEX.test(this.definitionId)) {
            this.materialType = this.settings.material_type?.default_value as string;
        }
    }
}


export default MaterialPresetModel;
