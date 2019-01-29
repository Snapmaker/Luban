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

export const computeTransformationSizeForTextVector = (origin, config) => {
    const { text, size } = config;
    const numberOfLines = text.split('\n').length;
    const height = size / 72 * 25.4 * numberOfLines;
    const width = height / origin.height * origin.width;
    return {
        width: width,
        height: height
    };
};
