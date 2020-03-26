import * as THREE from 'three';
import { generateToolPathObject3D } from '../generator';
import { DATA_PREFIX } from '../../constants';

const GCODE_CONFIG_PLACEHOLDER = {
    jogSpeed: 'jogSpeed',
    workSpeed: 'workSpeed',
    dwellTime: 'dwellTime',
    plungeSpeed: 'plungeSpeed'
};

class ToolPathModel {
    constructor(toolPathModelInfo) {
        const { modelID, config, gcodeConfig } = toolPathModelInfo;

        this.modelID = modelID;

        this.id = null;

        this.printOrder = 1;
        this.gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

        this.config = {
            ...config
        };
        this.gcodeConfig = {
            ...gcodeConfig
        };

        this.toolPathFilename = null;
        this.toolPathObj3D = null;
    }


    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    updateGcodeConfig(gcodeConfig) {
        this.gcodeConfig = {
            ...this.gcodeConfig,
            ...gcodeConfig
        };
    }

    getTaskInfo() {
        return {
            id: this.id,
            config: this.config,
            gcodeConfig: this.gcodeConfig,
            printOrder: this.printOrder,
            toolPathFilename: this.toolPathFilename,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
        };
    }

    generateToolPath3D(toolPath) {
        this.toolPathObj3D = generateToolPathObject3D(toolPath);
    }

    loadToolPath(filename) {
        this.toolPathFilename = filename;
        const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                (data) => {
                    const toolPath = JSON.parse(data);
                    this.generateToolPath3D(toolPath);
                    if (this.gcodeConfig.multiPassEnabled) {
                        this.estimatedTime = toolPath.estimatedTime * this.gcodeConfig.multiPasses;
                    } else {
                        this.estimatedTime = toolPath.estimatedTime;
                    }
                    return resolve(this.toolPathObj3D);
                }
            );
        });
    }

    // generateGcode() {
    //     const gcodeGenerator = new GcodeGenerator();
    //     const toolPath = this.toolPath;
    //
    //     return gcodeGenerator.parseToolPathObjToGcode(toolPath, this.gcodeConfig);
    // }

    clone() {
        const toolPathModel = new ToolPathModel(this);
        toolPathModel.printOrder = this.printOrder;
        toolPathModel.gcodeConfigPlaceholder = {
            ...this.gcodeConfigPlaceholder
        };
        return toolPathModel;
    }
}

export default ToolPathModel;
