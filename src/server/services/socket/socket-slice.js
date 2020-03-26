import slice from '../../slicer/slice';

const handleSlice = (socket, params) => {
    socket.emit('slice:started');
    slice(
        params,
        (progress) => {
            socket.emit('slice:progress', progress);
        },
        (sliceResult) => {
            const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight, gcodeFilePath } = { ...sliceResult };
            socket.emit('slice:completed', {
                gcodeFilename,
                gcodeFileLength,
                printTime,
                filamentLength,
                filamentWeight,
                gcodeFilePath
            });
        },
        (err) => {
            socket.emit('slice:error', err);
        }
    );
};

export default {
    handleSlice
};
