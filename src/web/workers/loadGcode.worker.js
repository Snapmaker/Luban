import isEmpty from 'lodash/isEmpty';
import gcodeObject3DGenerator from './GcodeObj3dGenerator/gcodeObject3DGenerator';


onmessage = (e) => {
    if (isEmpty(e.data)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }
    const { func, gcodeFilename } = e.data;
    if (!['3DP', 'laser', 'CNC'].includes(func)) {
        postMessage({ status: 'err', value: 'Unsupported func: ' + func });
        return;
    }
    if (isEmpty(gcodeFilename)) {
        postMessage({ status: 'err', value: 'GcodePath is empty' });
        return;
    }

    gcodeObject3DGenerator.generate4Print3D(
        gcodeFilename,
        (progress) => {
            postMessage({ status: 'progress', value: progress });
        },
        (err) => {
            postMessage({ status: 'err', value: err });
        }
    ).then((obj3d) => {
        const obj3dJson = obj3d.toJSON();
        postMessage({ status: 'rendered', value: obj3dJson });
    });
};
