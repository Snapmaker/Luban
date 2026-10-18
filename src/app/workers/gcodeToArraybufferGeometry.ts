import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import { Transfer } from 'threads';

import GcodeToBufferGeometryWorkspace from './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace';


export type GcodeToArraybufferGeometryData = {
    func: string;
    gcodeFilename?: string;
    gcode?: string;
    isPreview?: boolean;
    backendOrigin?: string;
};

const gcodeToArraybufferGeometry = (data: GcodeToArraybufferGeometryData) => {
    return new Observable((observer) => {
        if (isEmpty(data)) {
            observer.next({ status: 'err', value: 'Data is empty' });
            observer.complete();
            return;
        }

        const { func, gcodeFilename, gcode, isPreview = false, backendOrigin = '' } = data;

        // Support func=WORKSPACE only
        if (!['WORKSPACE'].includes(func.toUpperCase())) {
            observer.next({
                status: 'err',
                value: `Unsupported func: ${func}`,
                isPreview,
            });
            observer.complete();
            return;
        }

        if (isEmpty(gcodeFilename) && isEmpty(gcode)) {
            observer.next({
                status: 'err',
                value: 'Gcode filename and gcode is empty',
                isPreview,
            });
            observer.complete();
            return;
        }

        new GcodeToBufferGeometryWorkspace().parse(
            gcodeFilename,
            gcode,
            (result) => {
                const {
                    isDone,
                    bufferGeometry,
                    renderMethod,
                    axisWorkRange,
                } = result;

                const positions = Transfer(bufferGeometry.getAttribute('position').array);
                const colors = Transfer(bufferGeometry.getAttribute('a_color').array);
                const index = Transfer(bufferGeometry.getAttribute('a_index').array);
                const indexColors = Transfer(bufferGeometry.getAttribute('a_index_color').array);

                const _data = {
                    status: 'succeed',
                    isDone: isDone,
                    axisWorkRange,
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
            (err) => {
                observer.next({ status: 'err', value: err.message || String(err), isPreview });
                observer.complete();
            },
            backendOrigin
        );
    });
};

export default gcodeToArraybufferGeometry;
