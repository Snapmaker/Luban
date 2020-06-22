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

        this.hideFlag = false;

        this.needPreview = true;
        this.toolPathFilename = null;
        this.toolPathObj3D = null;
    }

    updateVisible(param) {
        this.toolPathObj3D && (this.toolPathObj3D.visible = param);
    }

    updateNeedPreview(param) {
        this.needPreview = param;
        if (param) {
            this.id = '';
        }
    }

    updateMode(mode, gcodeConfig) {
        if (mode === this.mode) {
            return;
        }
        this.updateNeedPreview(true);
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
        this.updateNeedPreview(true);
    }

    getTaskInfo() {
        return {
            id: this.id,
            printOrder: this.printOrder,
            needPreview: this.needPreview,
            gcodeConfig: this.gcodeConfig,
            toolPathFilename: this.toolPathFilename,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder,
            hideFlag: this.hideFlag
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
