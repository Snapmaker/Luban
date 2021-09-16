import STLToSvgStack from '../../lib/MeshProcess/STLToSvgStack';

export const cutModel = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }
    try {
        onProgress(0.05);
        const stlToSvgStack = new STLToSvgStack(modelInfo);
        const svgFiles = stlToSvgStack.toSVGStackFiles();
        onProgress(0.5);
        const stlFile = stlToSvgStack.toSVGStackSTL();
        onProgress(1);
        return Promise.resolve({
            svgFiles,
            stlFile
        });
    } catch (e) {
        return Promise.reject(new Error(`Unknown error: ${e}`));
    }
}
