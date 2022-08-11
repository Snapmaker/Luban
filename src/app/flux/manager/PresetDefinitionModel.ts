import { cloneDeep } from 'lodash';
import {
    HEAD_PRINTING
} from '../../constants';


const DEFAULE_PARAMS_FOR_OTHERS = {
    'layer_height': {
        'options': {
            'fine': {
                'affect': {
                    'layer_height': 0.08,
                    'layer_height_0': 0.28,
                },
                'value': 0.08,
                'label': 'key-Luban/Preset/Layer Height-Fine'
            },
            'balanced': {
                'affect': {
                    'layer_height': 0.16,
                    'layer_height_0': 0.28,
                },
                'value': 0.16,
                'label': 'key-Luban/Preset/Layer Height-Medium'
            },
            'rough': {
                'affect': {
                    'layer_height': 0.24,
                    'layer_height_0': 0.28,
                },
                'value': 0.24,
                'label': 'key-Luban/Preset/Layer Height-Rough'
            },
        },
        'current_value': 0.08,
        'default_value': 'rough'
    },
    'speed_print': {
        'affectByType': true,
        'universal': {
            'low': {
                'affect': {
                    'speed_print': 40,
                    'speed_wall_0': 10,
                    'speed_wall_x': 15,
                    'speed_topbottom': 20,
                    'speed_infill': 40,
                    'speed_travel': 60
                },
                'value': 40,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 50,
                    'speed_wall_0': 15,
                    'speed_wall_x': 20,
                    'speed_topbottom': 25,
                    'speed_infill': 50,
                    'speed_travel': 70
                },
                'value': 50,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 20,
                    'speed_wall_x': 25,
                    'speed_topbottom': 30,
                    'speed_infill': 60,
                    'speed_travel': 80
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'quik': {
            'low': {
                'affect': {
                    'speed_print': 40,
                    'speed_wall_0': 20,
                    'speed_wall_x': 20,
                    'speed_topbottom': 20,
                    'speed_infill': 40,
                    'speed_travel': 60
                },
                'value': 40,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 50,
                    'speed_wall_0': 25,
                    'speed_wall_x': 25,
                    'speed_topbottom': 25,
                    'speed_infill': 50,
                    'speed_travel': 70
                },
                'value': 50,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 30,
                    'speed_wall_x': 30,
                    'speed_topbottom': 30,
                    'speed_infill': 60,
                    'speed_travel': 80
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'fine': {
            'low': {
                'affect': {
                    'speed_print': 40,
                    'speed_wall_0': 10,
                    'speed_wall_x': 10,
                    'speed_topbottom': 20,
                    'speed_infill': 40,
                    'speed_travel': 50
                },
                'value': 40,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 50,
                    'speed_wall_0': 15,
                    'speed_wall_x': 15,
                    'speed_topbottom': 25,
                    'speed_infill': 50,
                    'speed_travel': 60
                },
                'value': 50,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 20,
                    'speed_wall_x': 20,
                    'speed_topbottom': 30,
                    'speed_infill': 50,
                    'speed_travel': 70
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'engineering': {
            'low': {
                'affect': {
                    'speed_print': 40,
                    'speed_wall_0': 10,
                    'speed_wall_x': 15,
                    'speed_topbottom': 20,
                    'speed_infill': 45,
                    'speed_travel': 60
                },
                'value': 40,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 50,
                    'speed_wall_0': 15,
                    'speed_wall_x': 20,
                    'speed_topbottom': 25,
                    'speed_infill': 45,
                    'speed_travel': 70
                },
                'value': 50,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 20,
                    'speed_wall_x': 25,
                    'speed_topbottom': 30,
                    'speed_infill': 45,
                    'speed_travel': 80
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'current_value': 0.08,
        'default_value': 'high'
    },
    'infill_sparse_density': {
        'affectByType': true,
        'universal': {
            'normal_weak': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 10,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 10,
                'label': 'key-Luban/Preset/Model Structure-Thin'
            },
            'normal_normal': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'trihexagon',
                    'infill_sparse_density': 15,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 15,
                'label': 'key-Luban/Preset/Model Structure-Medium'
            },
            'normal_strong': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 4,
                    'infill_pattern': 'cubic',
                    'infill_sparse_density': 25,
                    'top_thickness': 1.2,
                    'bottom_thickness': 1.2
                },
                'value': 25,
                'label': 'key-Luban/Preset/Model Structure-Strong'
            }
        },
        'quik': {
            'normal_weak': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 10,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 10,
                'label': 'key-Luban/Preset/Model Structure-Thin'
            },
            'normal_normal': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 15,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 15,
                'label': 'key-Luban/Preset/Model Structure-Medium'
            },
            'normal_strong': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 4,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 25,
                    'top_thickness': 1.2,
                    'bottom_thickness': 1.2
                },
                'value': 25,
                'label': 'key-Luban/Preset/Model Structure-Strong'
            }
        },
        'fine': {
            'normal_weak': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 10,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 10,
                'label': 'key-Luban/Preset/Model Structure-Thin'
            },
            'normal_normal': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 15,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 15,
                'label': 'key-Luban/Preset/Model Structure-Medium'
            },
            'normal_strong': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 4,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 25,
                    'top_thickness': 1.2,
                    'bottom_thickness': 1.2
                },
                'value': 25,
                'label': 'key-Luban/Preset/Model Structure-Strong'
            }
        },
        'engineering': {
            'normal_weak': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'trihexagon',
                    'infill_sparse_density': 10,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 10,
                'label': 'key-Luban/Preset/Model Structure-Thin'
            },
            'normal_normal': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'trihexagon',
                    'infill_sparse_density': 20,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 20,
                'label': 'key-Luban/Preset/Model Structure-Medium'
            },
            'normal_strong': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 4,
                    'infill_pattern': 'cubic',
                    'infill_sparse_density': 25,
                    'top_thickness': 1.2,
                    'bottom_thickness': 1.2
                },
                'value': 25,
                'label': 'key-Luban/Preset/Model Structure-Strong'
            }
        },
        'current_value': 'normal_weak',
        'default_value': 'normal_normal'
    },
    // Support Type
    'support_generate_type': {
        'options': {
            'Normal': {
                'affect': {
                    'support_generate_type': 'normal',
                    'support_roof_enable': true,
                    'support_roof_height': 2,
                    'support_roof_pattern': 'zigzag',
                    'minimum_roof_area': 4,
                    'support_roof_offset': 2
                },
                'value': 'normal',
                'label': 'key-Luban/Preset/Support Type-Normal'
            },
            'None': {
                'affect': {
                    'support_generate_type': 'none'
                },
                'value': 'none',
                'label': 'key-Luban/Preset/Support Type-None'
            },
        },
        'current_value': 'normal',
        'default_value': 'None'
    },
    'adhesion_type': {
        'options': {
            'Skirt': {
                'affect': {
                    'adhesion_type': 'skirt'
                },
                'value': 'skirt',
                'label': 'Skirt'
            },
            'Brim': {
                'affect': {
                    'adhesion_type': 'brim'
                },
                'value': 'brim',
                'label': 'Brim'
            },
            'Raft': {
                'affect': {
                    'adhesion_type': 'raft'
                },
                'value': 'raft',
                'label': 'Raft'
            }
        },
        'current_value': 'Skirt',
        'default_value': 'None'
    }
};
const DEFAULE_PARAMS_FOR_TPU = {
    'layer_height': {
        'options': {
            'fine': {
                'affect': {
                    'layer_height': 0.08,
                    'layer_height_0': 0.28,
                },
                'value': 0.08,
                'label': 'key-Luban/Preset/Layer Height-Fine'
            },
            'balanced': {
                'affect': {
                    'layer_height': 0.16,
                    'layer_height_0': 0.28,
                },
                'value': 0.16,
                'label': 'key-Luban/Preset/Layer Height-Medium'
            },
            'rough': {
                'affect': {
                    'layer_height': 0.24,
                    'layer_height_0': 0.28,
                },
                'value': 0.24,
                'label': 'key-Luban/Preset/Layer Height-Rough'
            },
        },
        'current_value': 0.08,
        'default_value': 'rough'
    },
    // changed
    'speed_print': {
        'options': {
            'low': {
                'affect': {
                    'speed_print': 25,
                    'speed_wall_0': 10,
                    'speed_wall_x': 15,
                    'speed_topbottom': 15,
                    'speed_infill': 25,
                    'speed_travel': 60
                },
                'value': 25,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 30,
                    'speed_wall_0': 10,
                    'speed_wall_x': 15,
                    'speed_topbottom': 20,
                    'speed_infill': 30,
                    'speed_travel': 60
                },
                'value': 30,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 40,
                    'speed_wall_0': 15,
                    'speed_wall_x': 20,
                    'speed_topbottom': 25,
                    'speed_infill': 40,
                    'speed_travel': 70
                },
                'value': 40,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'current_value': 'middle',
        'default_value': 'middle'
    },
    'infill_sparse_density': {
        'options': {
            'normal_weak': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'lines',
                    'infill_sparse_density': 10,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 10,
                'label': 'key-Luban/Preset/Model Structure-Thin'
            },
            'normal_normal': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 3,
                    'infill_pattern': 'trihexagon',
                    'infill_sparse_density': 15,
                    'top_thickness': 1,
                    'bottom_thickness': 1
                },
                'value': 15,
                'label': 'key-Luban/Preset/Model Structure-Medium'
            },
            'normal_strong': {
                'affect': {
                    'model_structure_type': 'normal',
                    'wall_line_count': 4,
                    'infill_pattern': 'cubic',
                    'infill_sparse_density': 25,
                    'top_thickness': 1.2,
                    'bottom_thickness': 1.2
                },
                'value': 25,
                'label': 'key-Luban/Preset/Model Structure-Strong'
            }
        },
        'current_value': 'normal_weak',
        'default_value': 'normal_normal'
    },
    // Support Type
    'support_generate_type': {
        'options': {
            'Normal': {
                'affect': {
                    'support_generate_type': 'normal',
                    'support_roof_enable': true,
                    'support_roof_height': 2,
                    'support_roof_pattern': 'zigzag',
                    'minimum_roof_area': 4,
                    'support_roof_offset': 2
                },
                'value': 'normal',
                'label': 'key-Luban/Preset/Support Type-Normal'
            },
            'None': {
                'affect': {
                    'support_generate_type': 'none'
                },
                'value': 'none',
                'label': 'key-Luban/Preset/Support Type-None'
            },
        },
        'current_value': 'Normal',
        'default_value': 'None'
    },
    'adhesion_type': {
        'options': {
            'Skirt': {
                'affect': {
                    'adhesion_type': 'skirt'
                },
                'value': 'skirt',
                'label': 'Skirt'
            },
            'Brim': {
                'affect': {
                    'adhesion_type': 'brim'
                },
                'value': 'brim',
                'label': 'Brim'
            },
            'Raft': {
                'affect': {
                    'adhesion_type': 'raft'
                },
                'value': 'raft',
                'label': 'Raft'
            }
        },
        'current_value': 'Skirt',
        'default_value': 'None'
    }
};
const OTHER_MATERISL_TYPES = ['pla', 'abs', 'petg'];
const ALL_PRINTING_TYPES = ['universal', 'quik', 'fine', 'engineering'];
const DEFAULT_KEYS = [
    'definitionId',
    'name',
    'inherits',
    'category',
    'i18nName',
    'i18nName',
    'i18nCategory',
    'typeOfPrinting',
    'settings',
    'ownKeys'
];

type ParamsObjectOption = {
    [key: string]: {
        affect: {
            [option: string]: string | number | boolean
        },
        value: string | number | boolean;
        label: string | number | boolean
    }
}

type ParamsObjectType = {
    options?: ParamsObjectOption;
    'current_value': number | string | boolean;
    'default_value': number | string | boolean;
    affectByType?: boolean;
}
type ParamsModelType = {
    'layer_height': ParamsObjectType;
    'speed_print': ParamsObjectType;
    'infill_sparse_density': ParamsObjectType;
    'support_generate_type': ParamsObjectType;
    'adhesion_type': ParamsObjectType;
}

class PresetDefinitionModel {
    public headType: string = HEAD_PRINTING;
    public typeOfPrinting: string;
    public nozzleSize;
    public params: ParamsModelType;
    public materialType: string;
    private visible = false;

    public definitionId = '';
    public name = '';
    public inherits = '';
    public category = '';
    public i18nName = '';
    public i18nCategory = '';
    public settings: string = HEAD_PRINTING;
    public ownKeys: string[];

    // init definitionId and definition
    public constructor(definition, materialType, defaultNozzleSize) {
        Object.keys(definition).filter(a => {
            return !(a in DEFAULT_KEYS);
        })
            .forEach((key) => {
                this[key] = definition[key];
            });
        this.updateParams(materialType, defaultNozzleSize, true);
    }

    public updateParams(
        materialType = this.materialType,
        nozzleSize = this.nozzleSize,
        shouldUpdateDefault = false
    ) {
        const settings = this.settings;
        if ((materialType && materialType !== this.materialType) || (nozzleSize && nozzleSize !== this.nozzleSize)) {
            this.materialType = materialType;
            this.nozzleSize = nozzleSize;
            // todo change getting 'typeOfPrinting' from setting's param
            if (materialType === 'tpu' && Number(nozzleSize) === 0.4 && this.typeOfPrinting) {
                if (this.typeOfPrinting) {
                    if (this.typeOfPrinting === ALL_PRINTING_TYPES[0]) {
                        this.visible = true;
                        this.params = cloneDeep(DEFAULE_PARAMS_FOR_TPU);
                    } else {
                        this.visible = false;
                    }
                } else {
                    this.visible = true;
                    this.params = cloneDeep(DEFAULE_PARAMS_FOR_TPU);
                }
            } else if (OTHER_MATERISL_TYPES.includes(materialType) && Number(nozzleSize) === 0.4 && this.typeOfPrinting) {
                if (this.typeOfPrinting) {
                    this.visible = true;
                    this.params = cloneDeep(DEFAULE_PARAMS_FOR_OTHERS);
                } else {
                    this.visible = true;
                    this.params = cloneDeep(DEFAULE_PARAMS_FOR_OTHERS);
                }
            } else {
                if (this.typeOfPrinting && this.typeOfPrinting !== ALL_PRINTING_TYPES[0]) {
                    this.visible = false;
                } else {
                    this.visible = true;
                }
                this.params = {
                    'layer_height': {
                        'options': {
                            'fine': {
                                'affect': {
                                    'layer_height': (this.nozzleSize * 0.3).toFixed(2),
                                },
                                'value': (this.nozzleSize * 0.3).toFixed(2),
                                'label': 'key-Luban/Preset/Layer Height-Fine'
                            },
                            'balanced': {
                                'affect': {
                                    'layer_height': (this.nozzleSize * 0.5).toFixed(2),
                                },
                                'value': (this.nozzleSize * 0.5).toFixed(2),
                                'label': 'key-Luban/Preset/Layer Height-Medium'
                            },
                            'rough': {
                                'affect': {
                                    'layer_height': (this.nozzleSize * 0.7).toFixed(2)
                                },
                                'value': (this.nozzleSize * 0.7).toFixed(2),
                                'label': 'key-Luban/Preset/Layer Height-Rough'
                            }
                        },
                        'current_value': (this.nozzleSize * 0.5).toFixed(2),
                        'default_value': 'rough'
                    },
                    'speed_print': {
                        'options': {
                            'low': {
                                'affect': {
                                    'speed_print': 20
                                },
                                'value': 20,
                                'label': 'key-Luban/Preset/Print Speed-Slow'
                            },
                            'middle': {
                                'affect': {
                                    'speed_print': 40
                                },
                                'value': 40,
                                'label': 'key-Luban/Preset/Print Speed-Medium'
                            },
                            'high': {
                                'affect': {
                                    'speed_print': 60
                                },
                                'value': 60,
                                'label': 'key-Luban/Preset/Print Speed-Medium'
                            },
                        },
                        'current_value': 40,
                        'default_value': 'middle'
                    },
                    'infill_sparse_density': {
                        'options': {
                            'normal_weak': {
                                'affect': {
                                    'infill_sparse_density': 10
                                },
                                'value': 10,
                                'label': 'key-Luban/Preset/Model Structure-Thin'
                            },
                            'normal_normal': {
                                'affect': {
                                    'infill_sparse_density': 15
                                },
                                'value': 15,
                                'label': 'key-Luban/Preset/Model Structure-Medium'
                            },
                            'normal_strong': {
                                'affect': {
                                    'infill_sparse_density': 25
                                },
                                'value': 25,
                                'label': 'key-Luban/Preset/Model Structure-Strong'
                            }
                        },
                        'current_value': 10,
                        'default_value': 10
                    },
                    // Support Type
                    'support_generate_type': {
                        'options': {
                            'Normal': {
                                'affect': {
                                    'support_generate_type': 'normal',
                                    'support_roof_enable': true,
                                    'support_roof_height': 2,
                                    'support_roof_pattern': 'zigzag',
                                    'minimum_roof_area': 4,
                                    'support_roof_offset': 2
                                },
                                'value': 'normal',
                                'label': 'key-Luban/Preset/Support Type-Normal'
                            },
                            'None': {
                                'affect': {
                                    'support_generate_type': 'none'
                                },
                                'value': 'none',
                                'label': 'key-Luban/Preset/Support Type-None'
                            },
                        },
                        'current_value': 'Normal',
                        'default_value': 'None'
                    },
                    'adhesion_type': {
                        'options': {
                            'Skirt': {
                                'affect': {
                                    'adhesion_type': 'skirt'
                                },
                                'value': 'skirt',
                                'label': 'Skirt'
                            },
                            'Brim': {
                                'affect': {
                                    'adhesion_type': 'brim'
                                },
                                'value': 'brim',
                                'label': 'Brim'
                            },
                            'Raft': {
                                'affect': {
                                    'adhesion_type': 'raft'
                                },
                                'value': 'raft',
                                'label': 'Raft'
                            }
                        },
                        'current_value': 'Skirt',
                        'default_value': 'None'
                    }
                };
            }
        }
        if (this.visible) {
            Object.entries(this.params).forEach(([paramName, paramItem]) => {
                const actualValue = settings[paramName]?.default_value;
                const actualOptions: ParamsObjectOption = paramItem.affectByType ? paramItem[this.typeOfPrinting] : paramItem.options;
                const isDefautValue = Object.entries(actualOptions).some(([optionName, optionItem]) => {
                    if (optionItem.value === actualValue) {
                        paramItem.current_value = optionName;
                        if (shouldUpdateDefault) paramItem.default_value = optionName;
                        return true;
                    } else {
                        return false;
                    }
                });
                if (!isDefautValue) {
                    paramItem.current_value = actualValue;
                    if (shouldUpdateDefault) paramItem.default_value = actualValue;
                }
            });
        }
    }

    // public
    public getSerializableDefinition() {
        const {
            definitionId, name, category,
            i18nCategory, inherits, typeOfPrinting, ownKeys, settings
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

export default PresetDefinitionModel;
