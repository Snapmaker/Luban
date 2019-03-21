import isEmpty from 'lodash/isEmpty';
import { gcodeToObj3d } from './GcodeToObj3d';

onmessage = (e) => {
    if (isEmpty(e.data)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }
    const { func, gcodeFilename } = e.data;
    if (!['3DP', 'LASER', 'CNC'].includes(func.toUpperCase())) {
        postMessage({ status: 'err', value: 'Unsupported func: ' + func });
        return;
    }
    if (isEmpty(gcodeFilename)) {
        postMessage({ status: 'err', value: 'Gcode filename is empty' });
        return;
    }

    gcodeToObj3d(
        func.toUpperCase(),
        gcodeFilename,
        (progress) => {
            postMessage({ status: 'progress', value: progress });
        },
        (err) => {
            postMessage({ status: 'err', value: err });
        }
    ).then((obj3d) => {
        const obj3dJson = obj3d.toJSON();
        postMessage({ status: 'succeed', value: obj3dJson });
    });
};
