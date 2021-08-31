import isEmpty from 'lodash/isEmpty';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';
// import api from '../api';

onmessage = async (message) => {
    if (isEmpty(message.data)) {
        postMessage({
            status: 'err',
            value: 'Data is empty'
        });
        return;
    }
    const { taskResult } = message.data;
    const { headType } = taskResult;

    try {
        for (let i = 0; i < taskResult.data.length; i++) {
            const filename = taskResult.filenames[i];
            const renderResult = await new ToolpathToBufferGeometry().parse(
                filename,
                (progress) => {
                    postMessage({
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

            postMessage(
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

        postMessage(
            data
        );
    } catch (err) {
        postMessage({
            status: 'err',
            headType: headType,
            value: err
        });
    }
};
