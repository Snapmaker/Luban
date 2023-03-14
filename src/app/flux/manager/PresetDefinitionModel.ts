import { cloneDeep } from 'lodash';
import { HEAD_PRINTING, MATERIAL_REGEX, QUALITY_REGEX, } from '../../constants';


export const DEFAULE_PARAMS_FOR_OTHERS = {
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
        'options': {
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
        'current_value': 0.08,
        'default_value': 'high'
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

export const DEFAULT_PARAMS_FAST = {
    'layer_height': {
        'options': {
            'fine': {
                'affect': {
                    'layer_height': 0.12,
                    'layer_height_0': 0.28,
                },
                'value': 0.12,
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
        'current_value': 'rough',
        'default_value': 'rough'
    },
    'speed_print': {
        'options': {
            'low': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 30,
                    'speed_wall_x': 60,
                    'speed_topbottom': 60,
                    'speed_infill': 60,
                    'speed_travel': 60
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 105,
                    'speed_wall_0': 60,
                    'speed_wall_x': 60,
                    'speed_topbottom': 60,
                    'speed_infill': 60,
                    'speed_travel': 105,
                },
                'value': 105,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 200,
                    'speed_wall_0': 100,
                    'speed_wall_x': 100,
                    'speed_topbottom': 100,
                    'speed_infill': 100,
                    'speed_travel': 200,
                },
                'value': 200,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'current_value': 0.08,
        'default_value': 'high'
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

export const DEFAULT_PARAMS_MEDIUM = {
    'layer_height': {
        'options': {
            'fine': {
                'affect': {
                    'layer_height': 0.12,
                    'layer_height_0': 0.28,
                },
                'value': 0.12,
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
        'current_value': 'rough',
        'default_value': 'rough'
    },
    'speed_print': {
        'options': {
            'low': {
                'affect': {
                    'speed_print': 60,
                    'speed_wall_0': 30,
                    'speed_wall_x': 60,
                    'speed_topbottom': 60,
                    'speed_infill': 60,
                    'speed_travel': 60
                },
                'value': 60,
                'label': 'key-Luban/Preset/Print Speed-Slow'
            },
            'middle': {
                'affect': {
                    'speed_print': 100,
                    'speed_wall_0': 50,
                    'speed_wall_x': 50,
                    'speed_topbottom': 50,
                    'speed_infill': 50,
                    'speed_travel': 120,
                },
                'value': 100,
                'label': 'key-Luban/Preset/Print Speed-Medium'
            },
            'high': {
                'affect': {
                    'speed_print': 160,
                    'speed_wall_0': 100,
                    'speed_wall_x': 100,
                    'speed_topbottom': 100,
                    'speed_infill': 160,
                    'speed_travel': 200,
                },
                'value': 160,
                'label': 'key-Luban/Preset/Print Speed-Fast'
            },
        },
        'current_value': 'high',
        'default_value': 'high',
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

export const DEFAULE_PARAMS_FOR_TPU = {
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
            'normal': {
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
            'none': {
                'affect': {
                    'support_generate_type': 'none'
                },
                'value': 'none',
                'label': 'key-Luban/Preset/Support Type-None'
            },
        },
        'current_value': 'normal',
        'default_value': 'none'
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
        'default_value': 'Skirt'
    }
};

export function getPresetQuickParamsCalculated({ nozzleSize = 0.4 }) {
    return {
        'layer_height': {
            'options': {
                'fine': {
                    'affect': {
                        'layer_height': Number((nozzleSize * 0.3).toFixed(2)),
                    },
                    'value': Number((nozzleSize * 0.3).toFixed(2)),
                    'label': 'key-Luban/Preset/Layer Height-Fine'
                },
                'balanced': {
                    'affect': {
                        'layer_height': Number((nozzleSize * 0.5).toFixed(2)),
                    },
                    'value': Number((nozzleSize * 0.5).toFixed(2)),
                    'label': 'key-Luban/Preset/Layer Height-Medium'
                },
                'rough': {
                    'affect': {
                        'layer_height': Number((nozzleSize * 0.7).toFixed(2))
                    },
                    'value': Number((nozzleSize * 0.7).toFixed(2)),
                    'label': 'key-Luban/Preset/Layer Height-Rough'
                }
            },
            'current_value': Number((nozzleSize * 0.5).toFixed(2)),
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
                    'label': 'key-Luban/Preset/Print Speed-Fast'
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

const OTHER_MATERISL_TYPES = ['pla', 'abs', 'petg'];
// const DEFAULT_KEYS = [
//     'definitionId',
//     'name',
//     'inherits',
//     'category',
//     'i18nName',
//     'i18nCategory',
//     'typeOfPrinting',
//     'settings',
//     'ownKeys'
// ];

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

// TODO: material category & quality category is not the same, distinguish them by subclasses
class PresetDefinitionModel {
    public headType = HEAD_PRINTING;
    public typeOfPrinting = 'universal';
    public nozzleSize: number;
    public params: ParamsModelType;
    public materialType = 'pla';
    public qualityType: string;
    public visible = false;
    public definitionId = '';
    public name = '';
    private inherits = '';
    public category = '';
    public i18nName = '';
    public i18nCategory = '';
    public settings: { [key: string]: object };
    public ownKeys: string[];

    // init definitionId and definition
    public constructor(definition, materialType, defaultNozzleSize) {
        Object.keys(definition)
            .forEach((key) => {
                this[key] = definition[key];
            });

        if (QUALITY_REGEX.test(this.definitionId)) {
            this.updateParams(materialType, defaultNozzleSize, true);
        }

        // Assume that the materialType of material preset will never change
        if (MATERIAL_REGEX.test(this.definitionId)) {
            this.materialType = definition.settings.material_type.default_value;
        }
    }

    public updateParams(
        materialType = this.materialType,
        nozzleSize = this.nozzleSize,
        shouldUpdateDefault = false
    ) {
        const settings = this.settings;
        nozzleSize = Number(nozzleSize);
        if ((materialType && materialType !== this.materialType) || (nozzleSize && nozzleSize !== this.nozzleSize)) {
            this.materialType = materialType;
            this.nozzleSize = nozzleSize;
            // todo change getting 'typeOfPrinting' from setting's param
            if (materialType === 'tpu' && nozzleSize === 0.4) {
                if (this.typeOfPrinting && this.qualityType && this.qualityType !== 'tpu') {
                    this.visible = false;
                } else {
                    this.visible = true;
                    this.params = cloneDeep(DEFAULE_PARAMS_FOR_TPU);
                }
            } else if (OTHER_MATERISL_TYPES.includes(materialType) && nozzleSize === 0.4) {
                if (this.typeOfPrinting && this.qualityType && !(OTHER_MATERISL_TYPES.includes(this.qualityType))) {
                    this.visible = false;
                } else {
                    this.visible = true;
                    this.params = cloneDeep(DEFAULE_PARAMS_FOR_OTHERS);
                }
            } else {
                if (this.typeOfPrinting && this.qualityType && this.qualityType !== 'other') {
                    this.visible = false;
                } else {
                    this.visible = true;
                }
                this.params = getPresetQuickParamsCalculated({ nozzleSize: this.nozzleSize });
            }
        }
        if (this.visible) {
            Object.entries(this.params).forEach(([paramName, paramItem]) => {
                const actualValue = settings[paramName]?.default_value;
                const actualOptions: ParamsObjectOption = paramItem.affectByType ? paramItem[this.typeOfPrinting] : paramItem.options;
                const isDefaultValue = Object.entries(actualOptions).some(([optionName, optionItem]) => {
                    if (optionItem.value === actualValue) {
                        paramItem.current_value = optionName;
                        if (shouldUpdateDefault) paramItem.default_value = optionName;
                        return true;
                    } else {
                        return false;
                    }
                });
                if (!isDefaultValue) {
                    paramItem.current_value = actualValue;
                    if (shouldUpdateDefault) paramItem.default_value = actualValue;
                }
            });
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

export default PresetDefinitionModel;
