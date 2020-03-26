import isEmpty from 'lodash/isEmpty';
import GcodeToBufferGeometryWorkspace from './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace';

onmessage = (e) => {
    if (isEmpty(e.data)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }
    const { func, gcodeFilename, gcode } = e.data;
    if (!['WORKSPACE'].includes(func.toUpperCase())) {
        postMessage({ status: 'err', value: `Unsupported func: ${func}` });
        return;
    }
    if (isEmpty(gcodeFilename) && isEmpty(gcode)) {
        postMessage({ status: 'err', value: 'Gcode filename and gcode is empty' });
        return;
    }

    new GcodeToBufferGeometryWorkspace().parse(
        gcodeFilename,
        gcode,
        (result) => {
            const { bufferGeometry, renderMethod, isDone, boundingBox } = result;
            const positions = bufferGeometry.getAttribute('position').array;
            const colors = bufferGeometry.getAttribute('a_color').array;
            const index = bufferGeometry.getAttribute('a_index').array;
            const indexColors = bufferGeometry.getAttribute('a_index_color').array;

            const data = {
                status: 'succeed',
                isDone: isDone,
                boundingBox: boundingBox,
                renderMethod: renderMethod,
                value: {
                    positions,
                    colors,
                    index,
                    indexColors
                }
            };
            postMessage(
                data,
                [
                    positions.buffer,
                    colors.buffer,
                    index.buffer,
                    indexColors.buffer
                ]
            );
        },
        (progress) => {
            postMessage({ status: 'progress', value: progress });
        },
        (err) => {
            postMessage({ status: 'err', value: err });
        },
    ).then();
};
