import slice from '../../slicer/slice';

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
    console.log(params);
    socket.emit('generate-support:started');
    setTimeout(() => {
        socket.emit('generate-support:progress', 0.5);
    }, 1500);
    setTimeout(() => {
        socket.emit('generate-support:completed', {
            // gcodeFilename,
            // gcodeFileLength,
            // printTime,
            // filamentLength,
            // filamentWeight,
            // gcodeFilePath,
            // renderGcodeFileName
        });
    }, 3000);
    // socket.emit('generate-support:error', err);
};

export default {
    handleSlice,
    handleGenerateSupport
};
