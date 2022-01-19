// import { ProcessHost } from 'electron-re';
import isEmpty from 'lodash/isEmpty';
import workerpool from 'workerpool';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';


const onmessage = async (taskResult) => {
    if (isEmpty(taskResult.data)) {
        workerpool.workerEmit({
            status: 'err',
            value: 'Data is empty'
        });
        return;
    }
    const { headType } = taskResult;

    try {
        for (let i = 0; i < taskResult.data.length; i++) {
            const filename = taskResult.filenames[i];
            const renderResult = await new ToolpathToBufferGeometry().parse(
                filename,
                (progress) => {
                    workerpool.workerEmit({
                        status: 'progress',
                        headType: headType,
                        value: {
                            progress: progress / taskResult.data.length + i / taskResult.data.length
                        }
                    });
                },
            );

            const data = {
                status: 'data',
                headType: headType,
                value: {
                    taskResult: taskResult,
                    index: i,
                    renderResult: renderResult
                }
            };

            workerpool.workerEmit(
                data,
                [
                    renderResult.positions.buffer,
                    renderResult.gCodes.buffer
                ]
            );
        }

        const data = {
            status: 'succeed',
            headType: headType,
            value: {
                taskResult: taskResult
            }
        };

        workerpool.workerEmit(
            data
        );
    } catch (err) {
        workerpool.workerEmit({
            status: 'err',
            headType: headType,
            value: err
        });
    }
};
workerpool.worker({
    onmessage: onmessage
});

// ProcessHost.register('on-message', (taskResult) => {
//     return onmessage(taskResult);
// });
