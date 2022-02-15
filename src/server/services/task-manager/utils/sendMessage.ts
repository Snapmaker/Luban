import workerpool from 'workerpool';

const sendMessage = (message: unknown) => {
    workerpool.workerEmit(message);
};

export default sendMessage;
