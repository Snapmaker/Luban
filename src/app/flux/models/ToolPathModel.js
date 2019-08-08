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
        const { modelID, config, gcodeConfig, mode } = toolPathModelInfo;

        this.modelID = modelID;

        this.taskID = null;

        this.mode = mode; // greyscale bw vector trace
        this.movementMode = 'line';
        this.printOrder = 1;
        this.gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

        this.config = config;
        this.gcodeConfig = gcodeConfig;

        this.toolPath = null;
        this.toolPathObj3D = null;
    }

    updatePrintOrder(printOrder) {
        this.printOrder = printOrder;
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
            mode: this.mode,
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
}

export default ToolPathModel;
