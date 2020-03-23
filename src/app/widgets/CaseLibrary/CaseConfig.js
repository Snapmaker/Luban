import { CNC_TOOL_SNAP_FLAT_END_MILL } from '../../constants';

export const CaseConfig150 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printing Spiral Vase',
        imgSrc: '../../images/user-case/A150/3D-A150.png',
        pathConfig: {
            name: '3DP_test_A150.stl',
            casePath: './A150/'
        },
        material: {
            definitionId: 'Caselibrary.Vase.A150.material', // pla,stl
            // material_diameter: 1.75,
            // material_flow: 100,
            // material_print_temperature: 198,
            // material_print_temperature_layer_0: 200,
            // material_final_print_temperature: 198,
            material_bed_temperature_layer_0: 50
        },
        quality: {
            isRecommand: false,
            definitionId: 'Caselibrary.Vase.A150.quality',
            layer_height: 0.16,

            // layer_height: 0.16,
            speed_wall_0: 40,
            layer_height_0: 0.25,
            magic_spiralize: true
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cutting Gift Box',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/Laser-A150.png',
        pathConfig: {
            name: 'Laser_test_A150.svg',
            casePath: './A150'
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
        title: 'CNC Cutting Keychain',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/CNC-A150.png',
        pathConfig: {
            name: 'CNC_test_A150.svg',
            casePath: './A150/'
        },
        caseConfigs: {
            tool: CNC_TOOL_SNAP_FLAT_END_MILL,
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
        title: '3D Printing Spiral Vase',
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            name: '3DP_test_A250.stl',
            casePath: './A250/'
        },
        material: {
            // pla,stl
            definitionId: 'Caselibrary.Vase.A250.material',
            material_bed_temperature_layer_0: 50
        },
        quality: {
            isRecommand: false,
            definitionId: 'Caselibrary.Vase.A250.quality',
            layer_height: 0.16,
            layer_height_0: 0.25,
            speed_wall_0: 40,
            magic_spiralize: true
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cutting Gift Box',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/Laser-A250&A350.png',
        pathConfig: {
            name: 'Laser_test_A250.svg',
            casePath: './A150'
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
        title: 'CNC Cutting Smartphone Holder',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            name: 'CNC_test_A250.svg',
            casePath: './A250/'
        },
        caseConfigs: {
            tool: CNC_TOOL_SNAP_FLAT_END_MILL,
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
        title: '3D Printing Spiral Vase',
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            name: '3DP_test_A350.stl',
            casePath: './A350/'
        },
        material: {
            definitionId: 'Caselibrary.Vase.A350.material',
            material_bed_temperature_layer_0: 50
        },
        quality: {
            isRecommand: false,
            definitionId: 'Caselibrary.Vase.A350.quality',
            layer_height: 0.16,
            speed_wall_0: 40,
            layer_height_0: 0.25,
            magic_spiralize: true
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cutting Gift Box',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/Laser-A250&A350.png',
        pathConfig: {
            name: 'Laser_test_A350.svg',
            casePath: './A350'
        },
        caseConfigs: {
            tool: CNC_TOOL_SNAP_FLAT_END_MILL,
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
        title: 'CNC Cutting Smartphone Holder',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            name: 'CNC_test_A350.svg',
            casePath: './A350/'
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
