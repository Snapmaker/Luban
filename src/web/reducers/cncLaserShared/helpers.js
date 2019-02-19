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

export const computeTransformationSizeForTextVector = (text, size, { width, height }) => {
    const numberOfLines = text.split('\n').length;
    const newHeight = size / 72 * 25.4 * numberOfLines;
    const newWidth = newHeight / height * width;
    return {
        width: newWidth,
        height: newHeight
    };
};
