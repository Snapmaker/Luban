import {
    ACTION_RESET_CALCULATED_STATE,
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';

export const checkIsAllModelsPreviewed = (modelGroup, toolPathModelGroup) => {
    if (modelGroup.getModels().length === 0) {
        return false;
    }

    if (toolPathModelGroup.allNotHidedToolPathModelsArePreviewed()) {
        return true;
    }
    return false;
};

/**
 * 1 pt = 1/72 inch
 * 1 inch = 25.4mm
 * @param text
 * @param fontSize: font size, unit is pt.
 * @param lineHeight
 * @param size
 * @returns {{width: number, height: number}}
 */
export const computeTransformationSizeForTextVector = (text, fontSize, lineHeight, size) => {
    const numberOfLines = text.split('\n').length;
    // const newHeight = size / 72 * 25.4 * numberOfLines;
    // const newWidth = newHeight * whRatio;
    // Assume that limitSize.x === limitSize.y
    const estimatedHeight = fontSize / 72 * 25.4;
    let height = estimatedHeight + estimatedHeight * lineHeight * (numberOfLines - 1);
    let width = height / size.height * size.width;

    if (width === 0) {
        width = 0.01;
    }
    if (height === 0) {
        height = 0.01;
    }

    return {
        width,
        height
    };
};


export const baseActions = {
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    updateTransformation: (headType, transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            headType,
            transformation
        };
    },

    updateGcodeConfig: (headType, gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            headType,
            gcodeConfig
        };
    },

    updateConfig: (headType, config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            headType,
            config
        };
    },

    // Model configurations
    resetCalculatedState: (headType) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            headType
        };
    },

    render: (headType) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            renderingTimestamp: +new Date()
        }));
    }
};
