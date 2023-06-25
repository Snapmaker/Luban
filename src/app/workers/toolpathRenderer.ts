import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';

import ToolPathGeometryConverter from './GcodeToBufferGeometry/ToolPathGeometryConverter';

type ToolpathRendererData = {
    data: object;
    filenames: string[];
    taskId: string;
    headType: string;
};

const toolpathRenderer = (taskResult: ToolpathRendererData) => {
    return new Observable((observer) => {
        if (isEmpty(taskResult.data)) {
            observer.next({
                status: 'err',
                value: 'Data is empty'
            });
            observer.complete();
            return;
        }

        const { headType } = taskResult;

        try {
            const taskTotal = taskResult.data.length;
            let taskCompleted = 0;
            for (let i = 0; i < taskTotal; i++) {
                const filename = taskResult.filenames[i];

                console.log(`Generate geometry from tool path, ${filename}`);
                const converter = new ToolPathGeometryConverter();

                converter.parseAsync(
                    filename,
                    (progress: number) => {
                        observer.next({
                            status: 'progress',
                            headType: headType,
                            value: {
                                progress: (i + progress) / taskTotal,
                            }
                        });
                    },
                    (renderResult) => {
                        observer.next({
                            status: 'data',
                            headType: headType,
                            value: {
                                taskResult: taskResult,
                                index: i,
                                renderResult: renderResult,
                            }
                        });

                        taskCompleted++;
                        if (taskCompleted === taskTotal) {
                            observer.next({
                                status: 'succeed',
                                headType: headType,
                                value: {
                                    taskResult: taskResult,
                                }
                            });
                            observer.complete();
                        }
                    },
                );
            }
        } catch (err) {
            observer.next({
                status: 'err',
                headType: headType,
                value: err,
            });
            observer.complete();
        }
    });
};

export default toolpathRenderer;
