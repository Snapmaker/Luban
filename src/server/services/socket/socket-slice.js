import slice, { generateSupport } from '../../slicer/slice';

const handleSlice = (socket, params) => {
    socket.emit('slice:started');
    slice(
        params,
        (progress) => {
            socket.emit('slice:progress', progress);
        },
        (sliceResult) => {
            const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight, gcodeFilePath, renderGcodeFileName } = { ...sliceResult };
            socket.emit('slice:completed', {
                gcodeFilename,
                gcodeFileLength,
                printTime,
                filamentLength,
                filamentWeight,
                gcodeFilePath,
                renderGcodeFileName
            });
        },
        (err) => {
            socket.emit('slice:error', err);
        }
    );
};

const handleGenerateSupport = (socket, params) => {
    socket.emit('generate-support:started');
    generateSupport(
        params,
        (progress) => {
            socket.emit('generate-support:progress', progress);
        },
        (result) => {
            socket.emit('generate-support:completed', {
                supportFilePaths: result.files
            });
        },
        (err) => {
            socket.emit('generate-support:error', err);
        }
    );
};

export default {
    handleSlice,
    handleGenerateSupport
};
