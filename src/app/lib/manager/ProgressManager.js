import i18n from '../i18n';

export const STEP_STAGE = {
    EMPTY: 0,

    // laser and cnc
    CNC_LASER_GENERATING_TOOLPATH: 1,
    CNC_LASER_GENERATE_TOOLPATH_SUCCESS: 2,
    CNC_LASER_GENERATE_TOOLPATH_FAILED: 3,
    CNC_LASER_PREVIEWING: 4,
    CNC_LASER_PREVIEW_SUCCESS: 5,
    CNC_LASER_PREVIEW_FAILED: 6,
    CNC_LASER_RE_PREVIEW: 7,
    CNC_LASER_GENERATING_GCODE: 8,
    CNC_LASER_GENERATE_GCODE_SUCCESS: 9,
    CNC_LASER_GENERATE_GCODE_FAILED: 10,
    CNC_LASER_UPLOADING_IMAGE: 11,
    CNC_LASER_UPLOAD_IMAGE_SUCCESS: 12,
    CNC_LASER_UPLOAD_IMAGE_FAILED: 13,
    CNC_LASER_PROCESSING_IMAGE: 14,
    CNC_LASER_PROCESS_IMAGE_SUCCESS: 15,
    CNC_LASER_PROCESS_IMAGE_FAILED: 16,
    CNC_LASER_GENERATING_VIEWPATH: 17,
    CNC_LASER_GENERATE_VIEWPATH_SUCCESS: 18,
    CNC_LASER_GENERATE_VIEWPATH_FAILED: 19,
    CNC_LASER_RENDER_TOOLPATH: 20,
    CNC_LASER_GENERATE_TOOLPATH_AND_PREVIEW: 21,
    CNC_LASER_RENDER_VIEWPATH: 22,

    // printing
    PRINTING_LOADING_MODEL: 23,
    PRINTING_LOAD_MODEL_SUCCEED: 24,
    PRINTING_LOAD_MODEL_FAILED: 25,
    PRINTING_SLICE_PREPARING: 26,
    PRINTING_SLICING: 27,
    PRINTING_SLICE_SUCCEED: 28,
    PRINTING_SLICE_FAILED: 29,
    PRINTING_PREVIEWING: 30,
    PRINTING_PREVIEW_SUCCEED: 31,
    PRINTING_PREVIEW_FAILED: 32
};

export const PROCESS_STAGE = {
    EMPTY: 0,

    // cnc laser
    CNC_LASER_GENERATE_TOOLPATH_AND_PREVIEW: 1,
    CNC_LASER_UPLOAD_IMAGE: 2, // upload and process
    CNC_LASER_PROCESS_IMAGE: 3,
    CNC_LASER_VIEW_PATH: 4, // simulation

    // printing
    PRINTING_LOAD_MODEL: 5,
    PRINTING_SLICE_AND_PREVIEW: 6
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
        return i18n._(this.notice, { progress: (progress * 100.0).toFixed(1) });
    }
}

class ProgressStatesManager {
    constructor() {
        this.progress = 0;
        this.processStageID = 0;
        this.progressStates = {};

        // cnc & laser
        this.push(PROCESS_STAGE.CNC_LASER_GENERATE_TOOLPATH_AND_PREVIEW, [
            {
                stageID: STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH,
                percent: 0.4
            },
            {
                stageID: STEP_STAGE.CNC_LASER_RENDER_TOOLPATH,
                percent: 0.8
            },
            {
                stageID: STEP_STAGE.CNC_LASER_GENERATING_GCODE,
                percent: 1
            }
        ], 'Generate toolpath and preview: {{progress}}%');
        this.push(PROCESS_STAGE.CNC_LASER_UPLOAD_IMAGE, [
            {
                stageID: STEP_STAGE.CNC_LASER_UPLOADING_IMAGE,
                percent: 0.5
            },
            {
                stageID: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
                percent: 1
            }
        ], 'Loading object {{progress}}%');
        this.push(PROCESS_STAGE.CNC_LASER_PROCESS_IMAGE, [
            {
                stageID: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
                percent: 1
            }
        ], 'Processing object {{progress}}%');
        this.push(PROCESS_STAGE.CNC_LASER_VIEW_PATH, [
            {
                stageID: STEP_STAGE.CNC_LASER_GENERATING_VIEWPATH,
                percent: 0.9
            },
            {
                stageID: STEP_STAGE.CNC_LASER_RENDER_VIEWPATH,
                percent: 1
            }
        ], 'Generating simulation {{progress}}%');
        // Printing
        this.push(PROCESS_STAGE.PRINTING_LOAD_MODEL, [
            {
                stageID: STEP_STAGE.PRINTING_LOADING_MODEL,
                percent: 1
            }
        ], 'Loading model...');
        this.push(PROCESS_STAGE.PRINTING_SLICE_AND_PREVIEW, [
            {
                stageID: STEP_STAGE.PRINTING_SLICING,
                percent: 0.5
            },
            {
                stageID: STEP_STAGE.PRINTING_PREVIEWING,
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

    getNotice(stageID, progress) {
        if (this.processStageID === PROCESS_STAGE.EMPTY) {
            return '';
        }
        return this.progressStates[this.processStageID].getNotice(stageID, progress);
        // switch (stage) {
        //     case CNC_LASER_STAGE.EMPTY:
        //         return '';
        //     case CNC_LASER_STAGE.GENERATING_TOOLPATH:
        //         return this.props.progressStatesManager.getNotice(1, stage, progress);
        //     // return i18n._('Generating toolpath... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
        //     case CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED:
        //         return i18n._('Failed to generate toolpath.');
        //     case CNC_LASER_STAGE.PREVIEWING:
        //         return this.props.progressStatesManager.getNotice(1, stage, progress);
        //     // return i18n._('Previewing toolpath...');
        //     case CNC_LASER_STAGE.PREVIEW_SUCCESS:
        //         return i18n._('Previewed toolpath successfully');
        //     case CNC_LASER_STAGE.PREVIEW_FAILED:
        //         return i18n._('Failed to preview toolpath.');
        //     case CNC_LASER_STAGE.GENERATING_GCODE:
        //         return this.props.progressStatesManager.getNotice(1, stage, progress);
        //     case CNC_LASER_STAGE.GENERATE_TOOLPATH_SUCCESS:
        //         return i18n._('Generating G-code... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
        //     case CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS:
        //         return i18n._('Generated G-code successfully.');
        //     case CNC_LASER_STAGE.GENERATE_GCODE_FAILED:
        //         return i18n._('Failed to generate G-code.');
        //     case CNC_LASER_STAGE.UPLOADING_IMAGE:
        //         return this.props.progressStatesManager.getNotice(2, stage, progress);
        //     case CNC_LASER_STAGE.UPLOAD_IMAGE_SUCCESS:
        //         return i18n._('Loaded object successfully.');
        //     case CNC_LASER_STAGE.UPLOAD_IMAGE_FAILED:
        //         return i18n._('Failed to load object.');
        //     case CNC_LASER_STAGE.PROCESSING_IMAGE:
        //         return this.props.progressStatesManager.getNotice(3, stage, progress);
        //     case CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS:
        //         return i18n._('Processed object successfully.');
        //     case CNC_LASER_STAGE.PROCESS_IMAGE_FAILED:
        //         return i18n._('Failed to process object.');
        //     case CNC_LASER_STAGE.RENDER_TOOLPATH:
        //         return this.props.progressStatesManager.getNotice(1, stage, progress);
        //     // return i18n._('Rendering toolpath... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
        //     case CNC_LASER_STAGE.GENERATE_TOOLPATH_AND_PREVIEW:
        //         return i18n._('Generate toolpath and preview: {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
        //     case CNC_LASER_STAGE.GENERATING_VIEWPATH:
        //     case CNC_LASER_STAGE.RENDER_VIEWPATH:
        //         return this.props.progressStatesManager.getNotice(4, stage, progress);
        //     default:
        //         return '';
        // }
        // switch (stage) {
        //     case PRINTING_STAGE.EMPTY:
        //         return '';
        //     case PRINTING_STAGE.LOADING_MODEL:
        //         return i18n._('Loading model...');
        //     case PRINTING_STAGE.LOAD_MODEL_SUCCEED:
        //         return i18n._('Loaded model successfully.');
        //     case PRINTING_STAGE.LOAD_MODEL_FAILED:
        //         return i18n._('Failed to load model.');
        //     case PRINTING_STAGE.SLICE_PREPARING:
        //         return i18n._('Preparing for slicing...');
        //     case PRINTING_STAGE.SLICING:
        //         return i18n._('Slicing...{{progress}}%', { progress: (100.0 * this.getProgress()).toFixed(1) });
        //     case PRINTING_STAGE.SLICE_SUCCEED:
        //         return i18n._('Sliced model successfully.');
        //     case PRINTING_STAGE.SLICE_FAILED:
        //         return i18n._('Failed to slice model.');
        //     case PRINTING_STAGE.PREVIEWING:
        //         return i18n._('Previewing G-code...{{progress}}%', { progress: (100.0 * this.getProgress()).toFixed(1) });
        //     case PRINTING_STAGE.PREVIEW_SUCCEED:
        //         return i18n._('Previewed G-code successfully.');
        //     case PRINTING_STAGE.PREVIEW_FAILED:
        //         return i18n._('Failed to load G-code.');
        //     default:
        //         return '';
        // }
    }

    startProgress(processStageID = PROCESS_STAGE.EMPTY, counts = []) {
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

    finishProgress() {
        this.processStageID = PROCESS_STAGE.EMPTY;
        this.progress = 0;
    }

    getProgressStage() {
        return this.processStageID;
    }
}

export default ProgressStatesManager;
