import isEmpty from 'lodash/isEmpty';
import { gcodeToBufferGeometry as _gcodeToBufferGeometry } from './GcodeToBufferGeometry/index';
import sendMessage from './utils/sendMessage';

const gcodeToBufferGeometry = async (message) => {
    if (isEmpty(message)) {
        sendMessage({ status: 'err', value: 'Data is empty' });
        return;
    }
    const { func, gcodeFilename, extruderColors } = message;
    if (!['3DP', 'LASER', 'CNC'].includes(func.toUpperCase())) {
        sendMessage({ status: 'err', value: `Unsupported func: ${func}` });
        return;
    }
    if (isEmpty(gcodeFilename)) {
        sendMessage({ status: 'err', value: 'Gcode filename is empty' });
        return;
    }

    const result = await _gcodeToBufferGeometry(
        func.toUpperCase(),
        gcodeFilename,
        extruderColors,
        (progress) => {
            sendMessage({ status: 'progress', value: progress });
        },
        (err) => {
            sendMessage({ status: 'err', value: err });
        }
    );
    const { bufferGeometry, layerCount, bounds, gcode } = result;
    const positions = bufferGeometry.getAttribute('position').array;
    const colors = bufferGeometry.getAttribute('a_color').array;
    const colors1 = bufferGeometry.getAttribute('a_color1').array;
    const layerIndices = bufferGeometry.getAttribute('a_layer_index').array;
    const typeCodes = bufferGeometry.getAttribute('a_type_code').array;
    const toolCodes = bufferGeometry.getAttribute('a_tool_code').array;
    const data = {
        status: 'succeed',
        value: {
            positions,
            colors,
            colors1,
            layerIndices,
            typeCodes,
            toolCodes,
            layerCount,
            bounds,
            gcode
        }
    };
    sendMessage(
        data,
        [
            positions.buffer,
            colors.buffer,
            colors1.buffer,
            layerIndices.buffer,
            typeCodes.buffer,
            toolCodes.buffer,
        ]
    );
};

export default gcodeToBufferGeometry;
