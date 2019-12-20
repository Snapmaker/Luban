export const CaseConfig = [
    {
        tag: '3dp', // 3dp、laser、cnc
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
        // sourceType: 'svg', // raster/svg/text
        mode: 'text', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/usercase/laser01.jpg',
        pathConfig: {
            name: '6456.bmp',
            casePath: '../../resources/usercase/'
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
                pathType: 'outline', // "outline"、 "pocket"
                safetyHeight: 0.2,
                stepDown: 0.2,
                stopHeight: 10,
                tabHeight: -0.5,
                tabSpace: 24,
                tabWidth: 2,
                enableTab: false,
                targetDepth: 2,

                text: 'jt tj ss',
                size: 30,
                font: 'Georgia',
                lineHeight: 1.5,
                alignment: 'left',
                fillEnabled: true, // bool
                fillDensity: 10, // 0~20
                isOptimizePath: false // bool

            },
            gcodeConfig: {
                jogSpeed: 1600,
                workSpeed: 220,
                multiPassEnabled: true,
                multiPassDepth: 2, // 2+
                multiPasses: 2, // 0+
                fixedPowerEnabled: true, // bool
                fixedPower: 90 // 0~100
            }
        },
        caseTransformation: {
            // text
            positionX: 1,
            positionY: 2,
            rotationZ: 90 / 180 * Math.PI,
            flip: 1
        }
    },
    {
        tag: 'laser',
        mode: 'text',
        imgSrc: '../../images/usercase/cnc01.jpg',
        pathConfig: {
            name: 'trace.jpg',
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
    },
    {
        tag: 'cnc',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/usercase/cnc01.jpg',
        pathConfig: {
            name: 'LaserTestA250Box.svg',
            casePath: '../../resources/usercase/'
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

                // cnc text: {
                pathType: 'outline', // "outline"、 "pocket"
                safetyHeight: 0.2,
                stepDown: 0.2,
                stopHeight: 10,
                tabHeight: -0.5,
                tabSpace: 24,
                tabWidth: 2,
                enableTab: false,
                targetDepth: 2,

                //
                toolAngle: 120,
                toolDiameter: 3.175,

                text: 'jt tj ss',
                size: 30,
                font: 'Georgia',
                lineHeight: 1.5,
                alignment: 'left',
                fillEnabled: true, // bool
                fillDensity: 10, // 0~20
                anchor: 'Center',
                isOptimizePath: false // bool
                // optimizePath: false

            },
            gcodeConfig: {
                jogSpeed: 1600,
                workSpeed: 220,
                multiPassEnabled: true,
                multiPassDepth: 2, // 2+
                multiPasses: 2, // 0+
                fixedPowerEnabled: true, // bool
                fixedPower: 90 // 0~100
            }
        },
        caseTransformation: {
            // text
            positionX: 1,
            positionY: 2,
            rotationZ: 90 / 180 * Math.PI,
            flip: 1
        }
    }
];
