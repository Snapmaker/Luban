// import { MATERIAL_REGEX } from '../../constants';
import PresetModel from './PresetModel';


class MaterialPresetModel extends PresetModel {
    /*
    public constructor(definition: object) {
        super(definition);

        if (MATERIAL_REGEX.test(this.definitionId)) {
            this.materialType = this.settings.material_type?.default_value as string;
        }
    }
    */

    public get materialType(): string {
        if (this.settings.material_type) {
            return this.settings.material_type?.default_value as string;
        } else {
            return 'pla';
        }
    }
}


export default MaterialPresetModel;
