export const CaseConfig = [
    {
        // default_value
        tag: '3dp',
        imgSrc: '../../images/usercase/3d01.jpg',
        pathConfig: {
            name: 'blade.STL',
            casePath: '../../resources/usercase/'
        },
        material: {
            definitionId: 'material.abs1',
            material_diameter: 1.75,
            material_flow: 100,
            material_print_temperature: 198,
            material_print_temperature_layer_0: 200,
            material_final_print_temperature: 198,
            machine_heated_bed: 1,
            material_bed_temperature: 100,
            material_bed_temperature_layer_0: 100
        },
        quality: {
            isRecommand: true,
            definitionId: 'quality.normal_quality1',
            layer_height: 1.1,
            top_thickness: 0.8,
            infill_sparse_density: 0.08,
            speed_infill: 60,
            speed_wall_0: 60,
            speed_wall_x: 60,
            speed_travel: 70
        }
    },
    {
        tag: 'laser',
        // mode: 'bw',
        // mode: 'greyscale',
        mode: 'vector',
        // mode: 'trace',
        imgSrc: '../../images/usercase/laser01.jpg',
        pathConfig: {
            name: 'LaserTestA250Box.svg',
            casePath: '../../resources/usercase/'
        },
        material: {
            definitionId: 'material.abs',
            material_diameter: 1.75,
            material_flow: 100,
            material_print_temperature: 198,
            material_print_temperature_layer_0: 200,
            material_final_print_temperature: 198,
            machine_heated_bed: 1,
            material_bed_temperature: 100,
            material_bed_temperature_layer_0: 100
        },
        quality: {
            isRecommand: true,
            definitionId: 'quality.normal_quality',
            layer_height: 1.1,
            top_thickness: 0.8,
            infill_sparse_density: 0.08,
            speed_infill: 60,
            speed_wall_0: 60,
            speed_wall_x: 60,
            speed_travel: 70
        }
    },
    {
        tag: '3dp',
        imgSrc: '../../images/usercase/cnc01.jpg',
        pathConfig: {
            name: 'blade.STL',
            casePath: '../../resources/usercase/'
        },
        material: {
            definitionId: 'material.abs1',
            material_diameter: 1.75,
            material_flow: 100,
            material_print_temperature: 198,
            material_print_temperature_layer_0: 200,
            material_final_print_temperature: 198,
            machine_heated_bed: 1,
            material_bed_temperature: 100,
            material_bed_temperature_layer_0: 100
        },
        quality: {
            isRecommand: true,
            definitionId: 'quality.fast_print',
            layer_height: 1.1,
            top_thickness: 0.8,
            infill_sparse_density: 0.08,
            speed_infill: 60,
            speed_wall_0: 60,
            speed_wall_x: 60,
            speed_travel: 70
        }
    }
];
