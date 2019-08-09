import * as THREE from 'three';
import { generateToolPathObject3D } from '../generator';
import { DATA_PREFIX } from '../../constants';
import GcodeGenerator from '../../widgets/GcodeGenerator';

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

        this.taskID = null;

        this.movementMode = 'line';
        this.printOrder = 1;
        this.gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

        this.config = {
            ...config
        };
        this.gcodeConfig = {
            ...gcodeConfig
        };

        this.toolPath = null;
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
            taskID: this.taskID,
            config: this.config,
            gcodeConfig: this.gcodeConfig,
            printOrder: this.printOrder,
            movementMode: this.movementMode,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
        };
    }

    generateToolPath3D() {
        if (!this.toolPath) {
            return;
        }

        this.toolPathObj3D = generateToolPathObject3D(this.toolPath);
    }

    loadToolPath(filename) {
        const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                (data) => {
                    this.toolPath = JSON.parse(data);
                    this.generateToolPath3D();
                    if (this.gcodeConfig.multiPassEnabled) {
                        this.estimatedTime = this.toolPath.estimatedTime * this.gcodeConfig.multiPasses;
                    } else {
                        this.estimatedTime = this.toolPath.estimatedTime;
                    }
                    return resolve(this.toolPathObj3D);
                }
            );
        });
    }

    generateGcode() {
        const gcodeGenerator = new GcodeGenerator();
        const toolPath = this.toolPath;

        return gcodeGenerator.parseToolPathObjToGcode(toolPath, this.gcodeConfig);
    }

    clone() {
        const toolPathModel = new ToolPathModel(this);
        toolPathModel.printOrder = this.printOrder;
        toolPathModel.movementMode = this.movementMode;
        toolPathModel.gcodeConfigPlaceholder = {
            ...this.gcodeConfigPlaceholder
        };
        return toolPathModel;
    }
}

export default ToolPathModel;
