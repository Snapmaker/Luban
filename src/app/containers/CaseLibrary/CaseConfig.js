export const CaseConfig = [
    {
        // default_value
        material: {
            'material_diameter': '1',
            'material_flow': '1',
            'material_print_temperature': '1',
            'material_print_temperature_layer_0': '1',
            'material_final_print_temperature': '1',
            'machine_heated_bed': '1',
            'material_bed_temperature': '1',
            'material_bed_temperature_layer_0': 1
        },
        configurations: {
            'layer_height': 1,
            'top_thickness': 1,
            'infill_sparse_density': 1,
            // 'speed_print': 1,
            'speed_infill': 1,
            'speed_wall_0': 1,
            'speed_wall_x': 1,
            'speed_travel': 1
        }
    },
    {
        material: {
            'material_diameter': '1',
            'material_flow': '1',
            'material_print_temperature': '1',
            'material_print_temperature_layer_0': '1',
            'material_final_print_temperature': '1',
            'machine_heated_bed': '1',
            'material_bed_temperature': '1',
            'material_bed_temperature_layer_0': 2
        },
        configurations: {
            'layer_height': 2,
            'top_thickness': 2,
            'infill_sparse_density': 2,
            // 'speed_print': 2,
            'speed_infill': 2,
            'speed_wall_0': 2,
            'speed_wall_x': 2,
            'speed_travel': 2
        }
    }
];
