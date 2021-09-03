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
    RENDER_TOOLPATH: 20,
    GENERATE_TOOLPATH_AND_PREVIEW: 21
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
        for (let index = 0; index < stages.length; index++) {
            this.stages[index].startPercent = (index === 0 ? 0 : this.stages[index - 1].percent);
        }
        this.notice = notice;
    }

    getNewProgress(stageID, progress, count = 1, totalCount = 1) {
        const stage = this.stages.find(s => s.stageID === stageID);
        return stage.startPercent + (stage.percent - stage.startPercent) * (count - 1) / totalCount + progress * (stage.percent - stage.startPercent) / totalCount;
    }

    getNotice(stageID, progress) {
        return i18n._(this.notice, { progress: (this.getNewProgress(stageID, progress) * 100.0).toFixed(1) });
    }
}

class ProgressStatesManager {
    constructor() {
        this.progress = 0;
        this.processStageID = 0;
        this.progressStates = {};

        this.push(CNC_LASER_PROCESS_STAGE.GENERATE_TOOLPATH_AND_PREVIEW, [
            {
                stageID: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                percent: 0.4
            },
            {
                stageID: CNC_LASER_STAGE.RENDER_TOOLPATH,
                percent: 0.8
            },
            {
                stageID: CNC_LASER_STAGE.GENERATING_GCODE,
                percent: 1
            }
        ], 'Generate toolpath and preview: {{progress}}%');
        this.push(CNC_LASER_PROCESS_STAGE.UPLOAD_IMAGE, [
            {
                stageID: CNC_LASER_STAGE.UPLOADING_IMAGE,
                percent: 1
            }
        ], 'Loading object {{progress}}%');
        this.push(CNC_LASER_PROCESS_STAGE.PROCESS_IMAGE, [
            {
                stageID: CNC_LASER_STAGE.PROCESSING_IMAGE,
                percent: 1
            }
        ], 'Processing object {{progress}}%');
        this.push(CNC_LASER_PROCESS_STAGE.VIEW_PATH, [
            {
                stageID: CNC_LASER_STAGE.GENERATING_VIEWPATH,
                percent: 1
            }
        ], 'Generating simulation {{progress}}%');
    }

    push(processStageID, stages, notice) {
        this.progressStates[processStageID] = new ProgressState(stages, notice);
    }

    getProgress(processStageID, stageID, progress, count, totalCount) {
        return this.progressStates[processStageID].getNewProgress(stageID, progress, count, totalCount);
    }

    getNotice(processStageID, stageID, progress) {
        return this.progressStates[processStageID].getNotice(stageID, progress);
    }

    startProgress(processStageID = CNC_LASER_PROCESS_STAGE.EMPTY, counts = []) {
        this.processStageID = processStageID;
        this.progress = 0;
        this.stage = 0;
        this.counts = counts;
        this.totalCounts = counts && [...counts];
    }

    updateProgress(stageID, progress) {
        const totalCount = this.totalCounts && this.totalCounts[this.stage];
        const count = this.counts && this.counts[this.stage];
        const newProgress = this.getProgress(this.processStageID, stageID, progress, (totalCount ?? 1) + 1 - (count ?? 1), totalCount ?? 1);
        if (newProgress > this.progress) {
            this.progress = newProgress;
        }
        if (this.progress > 1) {
            this.progress = 1;
        }
        return this.progress;
    }

    startNextStep() {
        if (this.counts && this.counts[this.stage] && this.counts[this.stage] - 1 > 0) {
            this.counts[this.stage] -= 1;
        } else {
            this.stage += 1;
        }
    }

    finishProgress() {}
}

export default ProgressStatesManager;
