import isEmpty from 'lodash/isEmpty';
import GcodeToBufferGeometryWorkspace from './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace';
import sendMessage from './utils/sendMessage';

const gcodeToArraybufferGeometry = (data) => {
    return new Promise((resolve, reject) => {
        if (isEmpty(data)) {
            resolve(sendMessage({ status: 'err', value: 'Data is empty' }));
        }
        const { func, gcodeFilename, gcode, isPreview = false } = data;
        if (!['WORKSPACE'].includes(func.toUpperCase())) {
            resolve(sendMessage({ status: 'err', value: `Unsupported func: ${func}` }));
        }
        if (isEmpty(gcodeFilename) && isEmpty(gcode)) {
            resolve(sendMessage({ status: 'err', value: 'Gcode filename and gcode is empty' }));
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

                const _data = {
                    status: 'succeed',
                    isDone: isDone,
                    boundingBox: boundingBox,
                    renderMethod: renderMethod,
                    isPreview,
                    gcodeFilename,
                    value: {
                        positions,
                        colors,
                        index,
                        indexColors
                    }
                };

                resolve(sendMessage(
                    _data,
                    [
                        positions.buffer,
                        colors.buffer,
                        index.buffer,
                        indexColors.buffer
                    ]
                ));
            },
            (progress) => {
                sendMessage({ status: 'progress', value: progress, isPreview });
            },
            (err) => {
                reject(sendMessage({ status: 'err', value: err }));
            },
        );
    });
};

export default gcodeToArraybufferGeometry;
