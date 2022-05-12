import { MINIMUM_WIDTH_AND_HEIGHT } from '../../constants/index';
import {
    ACTION_RESET_CALCULATED_STATE,
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
} from '../actionType';

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

    if (!width) {
        width = MINIMUM_WIDTH_AND_HEIGHT;
    }
    if (!height) {
        height = MINIMUM_WIDTH_AND_HEIGHT;
    }

    return {
        width,
        height
    };
};

const checkHeadType = (headType) => {
    if (!['laser', 'cnc'].includes(headType)) {
        console.error('headType is error', headType);
    }
};


export const baseActions = {
    updateState: (headType, state) => {
        checkHeadType(headType);
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    updateGcodeConfig: (headType, gcodeConfig) => {
        checkHeadType(headType);
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            headType,
            gcodeConfig
        };
    },

    updateConfig: (headType, config) => {
        checkHeadType(headType);
        return {
            type: ACTION_UPDATE_CONFIG,
            headType,
            config
        };
    },

    // Model configurations
    resetCalculatedState: (headType) => {
        checkHeadType(headType);
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            headType
        };
    },

    render: (headType) => (dispatch) => {
        checkHeadType(headType);
        dispatch(baseActions.updateState(headType, {
            renderingTimestamp: +new Date()
        }));
    }
};
