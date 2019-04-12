export const checkIsAllModelsPreviewed = (modelGroup) => {
    if (modelGroup.getModels().length === 0) {
        return false;
    }

    const models = modelGroup.getModels();
    for (let i = 0; i < models.length; i++) {
        if (['idle', 'previewing'].includes(models[i].stage)) {
            return false;
        }
    }

    return true;
};

/**
 * 1 pt = 1/72 inch
 * 1 inch = 25.4mm
 * @param text
 * @param size: font size, unit is pt.
 * @param width
 * @param height
 * @returns {{width: number, height: number}}
 */
export const computeTransformationSizeForTextVector = (text, size, { width, height }) => {
    const numberOfLines = text.split('\n').length;
    const newHeight = size / 72 * 25.4 * numberOfLines;
    const newWidth = newHeight / height * width;
    return {
        width: newWidth,
        height: newHeight
    };
};
