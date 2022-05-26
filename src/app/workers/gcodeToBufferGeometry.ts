import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import { Transfer } from 'threads';
import { gcodeToBufferGeometry as _gcodeToBufferGeometry } from './GcodeToBufferGeometry/index';

type ExtruderColorsData = {
    toolColor0: string;
    toolColor1: string;
};
type GcodeToBufferGeometryData = {
    func: string;
    gcodeFilename: string;
    extruderColors: ExtruderColorsData;
};

type GcodeBoundsData = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
};
type GcodeParsedData = {
    bufferGeometry: any;
    layerCount: number;
    bounds: GcodeBoundsData;
    gcode: string;
};

const gcodeToBufferGeometry = (message: GcodeToBufferGeometryData) => {
    return new Observable((observer) => {
        if (isEmpty(message)) {
            observer.next({ status: 'err', value: 'Data is empty' });
            return;
        }
        const { func, gcodeFilename, extruderColors } = message;
        if (!['3DP', 'LASER', 'CNC'].includes(func.toUpperCase())) {
            observer.next({
                status: 'err',
                value: `Unsupported func: ${func}`,
            });
            return;
        }
        if (isEmpty(gcodeFilename)) {
            observer.next({ status: 'err', value: 'Gcode filename is empty' });
            return;
        }

        _gcodeToBufferGeometry(
            func.toUpperCase(),
            gcodeFilename,
            extruderColors,
            (result: GcodeParsedData) => {
                const { bufferGeometry, layerCount, bounds, gcode } = result;
                const positions = Transfer(
                    bufferGeometry.getAttribute('position').array
                );
                const colors = Transfer(
                    bufferGeometry.getAttribute('a_color').array
                );
                const colors1 = Transfer(
                    bufferGeometry.getAttribute('a_color1').array
                );
                const layerIndices = Transfer(
                    bufferGeometry.getAttribute('a_layer_index').array
                );
                const typeCodes = Transfer(
                    bufferGeometry.getAttribute('a_type_code').array
                );
                const toolCodes = Transfer(
                    bufferGeometry.getAttribute('a_tool_code').array
                );
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
                        gcode, // TODO: used gcode parser
                    },
                };
                observer.next(data);
            },
            (progress: number) => {
                observer.next({ status: 'progress', value: progress });
            },
            (err: string) => {
                observer.next({ status: 'err', value: err });
            }
        );
    });
};

export default gcodeToBufferGeometry;
