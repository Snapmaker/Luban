import * as THREE from 'three';
import { generateToolPathObject3D } from '../flux/generator';
import { DATA_PREFIX } from '../constants';

const GCODE_CONFIG_PLACEHOLDER = {
    jogSpeed: 'jogSpeed',
    workSpeed: 'workSpeed',
    dwellTime: 'dwellTime',
    plungeSpeed: 'plungeSpeed'
};

class ToolPathModel {
    modeConfigs = {}

    constructor(toolPathModelInfo) {
        const { mode, modelID, gcodeConfig, modeConfigs } = toolPathModelInfo;

        this.modelID = modelID;
        this.mode = mode;

        this.id = null;

        this.printOrder = 1;
        this.gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

        this.gcodeConfig = {
            ...gcodeConfig
        };
        this.modeConfigs = {
            ...modeConfigs
        };

        this.visible = true;

        this.toolPathFilename = null;
        this.toolPathObj3D = null;

        this.isPreview = false;
    }


    updateMode(mode, gcodeConfig) {
        if (mode === this.mode) {
            return;
        }
        this.modeConfigs[this.mode] = {
            gcodeConfig: {
                ...this.gcodeConfig
            }
        };
        if (this.modeConfigs[mode]) {
            this.gcodeConfig = {
                ...this.modeConfigs[mode].gcodeConfig
            };
        } else {
            this.gcodeConfig = {
                ...gcodeConfig
            };
        }
        this.mode = mode;
    }

    updateGcodeConfig(gcodeConfig) {
        this.gcodeConfig = {
            ...this.gcodeConfig,
            ...gcodeConfig
        };
    }

    getTaskInfo() {
        return {
            printOrder: this.printOrder,
            gcodeConfig: this.gcodeConfig,
            toolPathFilename: this.toolPathFilename,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder,
            visible: this.visible
        };
    }

    loadToolPath(filename, isSelected = false) {
        this.toolPathFilename = filename;
        const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
        return new Promise((resolve) => {
            new THREE.FileLoader().load(
                toolPathFilePath,
                (data) => {
                    const toolPath = JSON.parse(data);
                    toolPath.isSelected = isSelected;
                    this.toolPathObj3D = generateToolPathObject3D(toolPath);
                    if (this.gcodeConfig.multiPassEnabled) {
                        this.estimatedTime = toolPath.estimatedTime * this.gcodeConfig.multiPasses;
                    } else {
                        this.estimatedTime = toolPath.estimatedTime;
                    }
                    this.isPreview = true;
                    return resolve(this.toolPathObj3D);
                }
            );
        });
    }

    clone() {
        const toolPathModel = new ToolPathModel(this);
        toolPathModel.printOrder = this.printOrder;
        toolPathModel.gcodeConfigPlaceholder = {
            ...this.gcodeConfigPlaceholder
        };
        return toolPathModel;
    }

    setRelatedModel(model) {
        this.relatedModel = model;
    }

    refresh() {}

    getGcodeConfig() {
        return this.gcodeConfig;
    }
}

export default ToolPathModel;
