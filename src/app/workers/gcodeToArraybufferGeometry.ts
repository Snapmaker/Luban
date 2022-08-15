import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import { Transfer } from 'threads';
import GcodeToBufferGeometryWorkspace from './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace';


type GcodeToArraybufferGeometryData = {
    func: string;
    gcodeFilename: string;
    gcode: string;
    isPreview: boolean;
};

const gcodeToArraybufferGeometry = (data: GcodeToArraybufferGeometryData) => {
    return new Observable((observer) => {
        if (isEmpty(data)) {
            observer.next({ status: 'err', value: 'Data is empty' });
        }
        const { func, gcodeFilename, gcode, isPreview = false } = data;
        if (!['WORKSPACE'].includes(func.toUpperCase())) {
            observer.next({
                status: 'err',
                value: `Unsupported func: ${func}`,
            });
            observer.complete();
            return;
        }
        if (isEmpty(gcodeFilename) && isEmpty(gcode)) {
            observer.next({
                status: 'err',
                value: 'Gcode filename and gcode is empty',
            });
            observer.complete();
            return;
        }

        new GcodeToBufferGeometryWorkspace().parse(
            gcodeFilename,
            gcode,
            (result) => {
                const {
                    bufferGeometry,
                    renderMethod,
                    isDone,
                    boundingBox,
                } = result;
                const positions = Transfer(
                    bufferGeometry.getAttribute('position').array
                );
                const colors = Transfer(
                    bufferGeometry.getAttribute('a_color').array
                );
                const index = Transfer(
                    bufferGeometry.getAttribute('a_index').array
                );
                const indexColors = Transfer(
                    bufferGeometry.getAttribute('a_index_color').array
                );

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
                        indexColors,
                    },
                };

                observer.next(_data);
                if (isDone) {
                    observer.complete();
                }
            },
            (progress: number) => {
                observer.next({
                    status: 'progress',
                    value: progress,
                    isPreview,
                });
            },
            (err: string) => {
                observer.next({ status: 'err', value: err });
                observer.complete();
            }
        );
    });
};

export default gcodeToArraybufferGeometry;
