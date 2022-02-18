import STLToSvgStack from '../../../lib/MeshProcess/STLToSvgStack';
import sendMessage from '../utils/sendMessage';

const cutModel = (modelInfo) => {
    if (!modelInfo) {
        return sendMessage({ status: 'fail', value: 'modelInfo is empty.' });
    }
    try {
        sendMessage({ status: 'progress', value: 0.05 });
        const stlToSvgStack = new STLToSvgStack(modelInfo);
        const svgFiles = stlToSvgStack.toSVGStackFiles();
        sendMessage({ status: 'progress', value: 0.5 });
        const stlFile = stlToSvgStack.toSVGStackSTL();
        sendMessage({ status: 'progress', value: 1 });

        return sendMessage({
            status: 'complete',
            value: {
                svgFiles,
                stlFile
            }
        });
    } catch (e) {
        return sendMessage({ status: 'fail', value: `Unknown error: ${e}` });
    }
};

export default cutModel;
