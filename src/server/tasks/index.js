import LevelingGcode from './LevelingGcode';

const Handlers = {
    LevelingGcode
};

const getTaskHandler = (taskName) => {
    const Handler = Handlers[taskName];
    if (typeof Handler !== 'function') {
        throw (new Error('error taskName: ', taskName));
    }
    return new Handler();
};


export default getTaskHandler;
