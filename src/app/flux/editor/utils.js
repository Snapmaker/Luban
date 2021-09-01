import i18n from '../../lib/i18n';

export const CNC_LASER_STAGE = {
    EMPTY: 0,
    GENERATING_TOOLPATH: 1,
    GENERATE_TOOLPATH_SUCCESS: 2,
    GENERATE_TOOLPATH_FAILED: 3,
    PREVIEWING: 4,
    PREVIEW_SUCCESS: 5,
    PREVIEW_FAILED: 6,
    RE_PREVIEW: 7,
    GENERATING_GCODE: 8,
    GENERATE_GCODE_SUCCESS: 9,
    GENERATE_GCODE_FAILED: 10,
    UPLOADING_IMAGE: 11,
    UPLOAD_IMAGE_SUCCESS: 12,
    UPLOAD_IMAGE_FAILED: 13,
    PROCESSING_IMAGE: 14,
    PROCESS_IMAGE_SUCCESS: 15,
    PROCESS_IMAGE_FAILED: 16,
    GENERATING_VIEWPATH: 17,
    GENERATE_VIEWPATH_SUCCESS: 18,
    GENERATE_VIEWPATH_FAILED: 19,
    RENDER_TOOLPATH: 20
};

export const CNC_LASER_PROCESS_STAGE = {
    EMPTY: 0,
    GENERATE_TOOLPATH_AND_PREVIEW: 1,
    UPLOAD_IMAGE: 2, // upload and process
    PROCESS_IMAGE: 3,
    VIEW_PATH: 4 // simulation
};

class ProgressState {
    constructor(stages, notice) {
        this.stages = stages;
        for (let index; index < stages.length; index++) {
            this.stages[index].startPercent = (index === 0 ? 0 : this.stages[index - 1].percent);
            console.log('stage', index, this.stages[index]);
        }
        this.notice = notice;
    }

    getNewProgress(stageID, progress) {
        const stage = this.stages.find(s => s.stageID === stageID);
        return stage.startPercent + progress * (stage.percent - stage.startPercent);
    }

    getNotice(stageID, progress) {
        return i18n._(this.notice, { progress: this.getNewProgress(stageID, progress) });
    }
}

class ProgressStatesManager {
    constructor() {
        this.progressStates = {};

        this.push(CNC_LASER_PROCESS_STAGE.GENERATE_TOOLPATH_AND_PREVIEW, [
            {
                stageID: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                percent: 0.4
            },
            {
                stageID: CNC_LASER_STAGE.RENDER_TOOLPATH,
                percent: 0.7
            },
            {
                stageID: CNC_LASER_STAGE.GENERATING_GCODE,
                percent: 1
            }
        ]);
        this.push(CNC_LASER_PROCESS_STAGE.UPLOAD_IMAGE, [
            {
                stageID: CNC_LASER_STAGE.UPLOADING_IMAGE,
                percent: 1
            }
        ]);
        this.push(CNC_LASER_PROCESS_STAGE.PROCESS_IMAGE, [
            {
                stageID: CNC_LASER_STAGE.UPLOADING_IMAGE,
                percent: 1
            }
        ]);
    }

    push(processStageID, stages, notice) {
        this.progressStates[processStageID] = new ProgressState(stages, notice);
    }

    getProgress(processStageID, stageID, progress) {
        this.progressStates[processStageID].getNewProgress(stageID, progress);
    }

    getNotice(processStageID, stageID, progress) {
        this.progressStates[processStageID].getNotice(stageID, progress);
    }
}

export default ProgressStatesManager;
