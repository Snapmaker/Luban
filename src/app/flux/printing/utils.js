import i18n from '../../lib/i18n';

export const PRINTING_STAGE = {
    EMPTY: 0,
    LOADING_MODEL: 1,
    LOAD_MODEL_SUCCEED: 2,
    LOAD_MODEL_FAILED: 3,
    SLICE_PREPARING: 4,
    SLICING: 5,
    SLICE_SUCCEED: 6,
    SLICE_FAILED: 7,
    PREVIEWING: 8,
    PREVIEW_SUCCEED: 9,
    PREVIEW_FAILED: 10
};

export const PRINTING_PROCESS_STAGE = {
    EMPTY: 0,
    LOAD_MODEL: 1,
    SLICE_AND_PREVIEW: 2
};

class ProgressState {
    constructor(stages, notice = '') {
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

        this.push(PRINTING_PROCESS_STAGE.LOAD_MODEL, [
            {
                stageID: PRINTING_STAGE.LOADING_MODEL,
                percent: 1
            }
        ], 'Loading model...');
        this.push(PRINTING_PROCESS_STAGE.SLICE_AND_PREVIEW, [
            {
                stageID: PRINTING_STAGE.SLICING,
                percent: 0.5
            },
            {
                stageID: PRINTING_STAGE.PREVIEWING,
                percent: 1
            }
        ], 'Previewing G-code...{{progress}}%');
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

    startProgress(processStageID = PRINTING_PROCESS_STAGE.EMPTY, counts = []) {
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
