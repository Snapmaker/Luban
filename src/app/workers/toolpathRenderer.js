import isEmpty from 'lodash/isEmpty';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';
import sendMessage from './utils/sendMessage';

const toolpathRenderer = async (taskResult) => {
    if (isEmpty(taskResult.data)) {
        sendMessage({
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
                    sendMessage({
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

            sendMessage(
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

        sendMessage(
            data
        );
    } catch (err) {
        sendMessage({
            status: 'err',
            headType: headType,
            value: err
        });
    }
};

export default toolpathRenderer;
