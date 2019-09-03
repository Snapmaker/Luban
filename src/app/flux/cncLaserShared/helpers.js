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
    const height = estimatedHeight + estimatedHeight * lineHeight * (numberOfLines - 1);
    const width = height / size.height * size.width;

    return {
        width,
        height
    };
};
