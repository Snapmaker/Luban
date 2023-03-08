import isEmpty from 'lodash/isEmpty';
import { Observable, forkJoin } from 'rxjs';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';

type ToolpathRendererData = {
    data: object;
    filenames: string[];
    taskId: string;
    headType: string;
};
const toolpathRenderer = (taskResult: ToolpathRendererData) => {
    return new Observable(subscriber => {
        if (isEmpty(taskResult.data)) {
            subscriber.next({
                status: 'err',
                value: 'Data is empty'
            });
            subscriber.complete();
            return;
        }
        const { headType } = taskResult;
        const allPromises = {};
        try {
            for (let i = 0; i < taskResult.data.length; i++) {
                const filename = taskResult.filenames[i];
                allPromises[i] = new ToolpathToBufferGeometry().parse(filename, (progress: number) => {
                    subscriber.next({
                        status: 'progress',
                        headType: headType,
                        value: {
                            progress: progress / taskResult.data.length + i / taskResult.data.length
                        }
                    });
                });
            }
        } catch (err) {
            subscriber.next({
                status: 'err',
                headType: headType,
                value: err
            });
            subscriber.complete();
        }

        forkJoin(allPromises).subscribe({
            next: result => {
                Object.entries(result).forEach(([index, renderResult]) => {
                    const data = {
                        status: 'data',
                        headType: headType,
                        value: {
                            taskResult: taskResult,
                            index: index,
                            renderResult: renderResult
                        }
                    };
                    subscriber.next(data);
                });
            },
            complete: () => {
                const data = {
                    status: 'succeed',
                    headType: headType,
                    value: {
                        taskResult: taskResult
                    }
                };
                subscriber.next(data);
                subscriber.complete();
            }
        });
    });
};

export default toolpathRenderer;
