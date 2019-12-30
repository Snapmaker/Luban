export const CaseConfig150 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printing Spiral Vase',
        imgSrc: '../../images/user-case/A150/3D-A150.png',
        pathConfig: {
            name: '3DP test A150.stl',
            casePath: '../../resources/usercase/A150/'
        },
        material: {
            definitionId: 'material.pla'// pla,stl
            // material_diameter: 1.75,
            // material_flow: 100,
            // material_print_temperature: 198,
            // material_print_temperature_layer_0: 200,
            // material_final_print_temperature: 198,
            // machine_heated_bed: 1,
            // material_bed_temperature: 100,
            // material_bed_temperature_layer_0: 100
        },
        quality: {
            isRecommand: false,
            definitionId: 'quality.normal_quality1',
            layer_height: 0.16,
            // top_thickness: 0.8,
            // infill_sparse_density: 0.08,
            // speed_infill: 60,
            // speed_wall_0: 60,
            // speed_wall_x: 60,
            // speed_travel: 70

            // layer_height: 0.16,
            layer_height_0: 0.25,
            // initial_layer_line_width_factor
            // wall_thickness
            // wall_line_count
            // top_thickness
            // top_layers
            // bottom_thickness
            // bottom_layers
            // outer_inset_first
            // infill_line_distance
            // infill_sparse_density
            // retraction_enable
            // retraction_speed
            // retraction_amount
            // retract_at_layer_change
            // speed_travel
            // speed_topbottom
            // speed_wall_x
            // speed_wall_0
            // speed_wall
            // speed_infill
            // speed_print
            // speed_print_layer_0
            // speed_travel_layer_0
            // skirt_brim_speed
            // retraction_hop
            // retraction_hop_enabled
            magic_spiralize: true
            // magic_mesh_surface_mode
            // adhesion_type
            // skirt_line_count: 1
            // brim_width
            // brim_line_count
            // raft_margin
            // support_enable
            // support_type
            // support_pattern
            // support_angle
            // support_infill_rate
            // support_line_distance
            // support_initial_layer_line_distance
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cutting Gift Box',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/Laser-A150.png',
        pathConfig: {
            name: 'Laser test A150.svg',
            casePath: '../../resources/usercase/A150'
        },
        caseConfigs: {
            config: {
                // greyscale: {
                // algorithm: 'FloydSteinburg',
                // brightness: 50,
                // bwThreshold: 168,
                // contrast: 50,
                // density: 4,
                // invertGreyscale: false,
                // movementMode: 'greyscale-line',
                // whiteClip: 100

                // // bw: {
                // invertGreyscale: 1,
                // bwThreshold: 1,
                // direction: 1,
                // density: 1,

                // // RasterVector: {
                // vectorThreshold: 1,
                // turdSize: 1,
                // isInvert: 1,
                // fillEnabled: true, // bool
                // fillDensity: 10, // 0~20
                // isOptimizePath: false // bool

                // text: {
                // pathType: 'outline', // "outline"、 "pocket"
                // safetyHeight: 0.2,
                // stepDown: 0.2,
                // stopHeight: 10,
                // tabHeight: -0.5,
                // tabSpace: 24,
                // tabWidth: 2,
                // enableTab: false,
                // targetDepth: 2,
                //
                // text: 'jt tj ss',
                // size: 30,
                // font: 'Georgia',
                // lineHeight: 1.5,
                // alignment: 'left',
                // fillEnabled: true, // bool
                // fillDensity: 10, // 0~20
                // isOptimizePath: false // bool

            },
            gcodeConfig: {
                jogSpeed: 3000,
                workSpeed: 140,
                multiPassEnabled: true,
                multiPassDepth: 0.6, // 2+
                multiPasses: 2, // 0+
                fixedPowerEnabled: true, // bool
                fixedPower: 100 // 0~100
            }
        },
        caseTransformation: {
            // text
            positionX: 0,
            positionY: 0,
            rotationZ: 0, // 90 / 180 * Math.PI
            flip: 0
        }
    },
    {
        tag: 'cnc',
        title: 'CNC Cutting Smartphone Holder',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/CNC-A150.png',
        pathConfig: {
            name: 'CNC test A150.svg',
            casePath: '../../resources/usercase/A150/'
        },
        caseConfigs: {
            config: {
                // //greyscale: {
                // algorithm: 'FloydSteinburg',
                // brightness: 50,
                // bwThreshold: 168,
                // contrast: 50,
                // density: 4,
                // invertGreyscale: false,
                // movementMode: 'greyscale-line',
                // whiteClip: 100

                // // bw: {
                // invertGreyscale: 1,
                // bwThreshold: 1,
                // direction: 1,
                // density: 1,

                // // RasterVector: {
                // vectorThreshold: 1,
                // turdSize: 1,
                // isInvert: 1,
                // fillEnabled: true, // bool
                // fillDensity: 10, // 0~20
                // isOptimizePath: false // bool

                // // cnc text: {
                // pathType: 'outline', // "outline"、 "pocket"
                // safetyHeight: 0.2,
                // stepDown: 0.2,
                // stopHeight: 10,
                // tabHeight: -0.5,
                // tabSpace: 24,
                // tabWidth: 2,
                // enableTab: false,
                // targetDepth: 2,
                //
                // //
                // toolAngle: 120,
                // toolDiameter: 3.175,
                //
                // text: 'jt tj ss',
                // size: 30,
                // font: 'Georgia',
                // lineHeight: 1.5,
                // alignment: 'left',
                // fillEnabled: true, // bool
                // fillDensity: 10, // 0~20
                // anchor: 'Center',
                // isOptimizePath: false // bool
                // // optimizePath: false

                targetDepth: 3.2,
                stepDown: 0.4,
                safetyHeight: 5,
                stopHeight: 10

            },
            gcodeConfig: {
                jogSpeed: 3000,
                plungeSpeed: 300,
                workSpeed: 300
                // multiPassEnabled: true,
                // multiPassDepth: 2, // 2+
                // multiPasses: 2, // 0+
                // fixedPowerEnabled: true, // bool
                // fixedPower: 90 // 0~100
            }
        },
        caseTransformation: {
            // text
            // positionX: 1,
            // positionY: 2,
            // rotationZ: 90 / 180 * Math.PI,
            // flip: 1
        }
    }
];

export const CaseConfig250 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            name: '3DP test A250.stl',
            casePath: '../../resources/usercase/A250/'
        },
        material: {
            definitionId: 'material.pla'// pla,stl
        },
        quality: {
            isRecommand: false,
            definitionId: 'quality.normal_quality1',
            layer_height: 0.16,
            layer_height_0: 0.25,
            magic_spiralize: true
        }
    },
    {
        tag: 'laser',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/Laser-A250&A350.png',
        pathConfig: {
            name: 'Laser test A150.svg',
            casePath: '../../resources/usercase/A150'
        },
        caseConfigs: {
            config: {

            },
            gcodeConfig: {
                jogSpeed: 3000,
                workSpeed: 140,
                multiPassEnabled: true,
                multiPassDepth: 0.6, // 2+
                multiPasses: 2, // 0+
                fixedPowerEnabled: true, // bool
                fixedPower: 100 // 0~100
            }
        },
        caseTransformation: {
            // text
            positionX: 0,
            positionY: 0,
            rotationZ: 0, // 90 / 180 * Math.PI
            flip: 0
        }
    },
    {
        tag: 'cnc',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            name: 'CNC test A250.svg',
            casePath: '../../resources/usercase/A250/'
        },
        caseConfigs: {
            config: {
                targetDepth: 3.2,
                stepDown: 0.4,
                safetyHeight: 5,
                stopHeight: 10
            },
            gcodeConfig: {
                jogSpeed: 3000,
                plungeSpeed: 400,
                workSpeed: 400
            }
        },
        caseTransformation: {
        }
    }
];

export const CaseConfig350 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            name: '3DP test A350.stl',
            casePath: '../../resources/usercase/A350/'
        },
        material: {
            definitionId: 'material.pla'// pla,stl
        },
        quality: {
            isRecommand: false,
            definitionId: 'quality.normal_quality1',
            layer_height: 0.16,
            layer_height_0: 0.25,
            magic_spiralize: true
        }
    },
    {
        tag: 'laser',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            name: 'Laser test A350.svg',
            casePath: '../../resources/usercase/A350'
        },
        caseConfigs: {
            config: {

            },
            gcodeConfig: {
                jogSpeed: 3000,
                workSpeed: 140,
                multiPassEnabled: true,
                multiPassDepth: 0.6, // 2+
                multiPasses: 2, // 0+
                fixedPowerEnabled: true, // bool
                fixedPower: 100 // 0~100
            }
        },
        caseTransformation: {
        }
    },
    {
        tag: 'cnc',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            name: 'CNC test A350.svg',
            casePath: '../../resources/usercase/A350/'
        },
        caseConfigs: {
            config: {
                targetDepth: 3.2,
                stepDown: 0.4,
                safetyHeight: 5,
                stopHeight: 10
            },
            gcodeConfig: {
                jogSpeed: 3000,
                plungeSpeed: 400,
                workSpeed: 400
            }
        },
        caseTransformation: {
        }
    }
];
