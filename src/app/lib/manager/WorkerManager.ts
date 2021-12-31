const EvaluateSupportArea = require('../../workers/EvaluateSupportArea.worker');
const CompareObject = require('../../workers/CompareObject.worker');

type Callback = (event: MessageEvent<any>) => any;
class WorkerManager {
    compareObjectWorker: Worker;

    constructor() {
        this.compareObjectWorker = new CompareObject();
        this.compareObjectWorker.onerror = () => {};
    }

    run(WorkerConstructor: any, transferData: Object, callback: Callback): Worker {
        const worker: Worker = new WorkerConstructor();
        worker.postMessage(transferData);
        worker.onmessage = callback;
        worker.onerror = () => {};
        return worker;
    }

    evaluateSupportArea(transferData: Object, callback: Callback): Worker {
        return this.run(EvaluateSupportArea, transferData, callback);
    }

    compareObject(transferData: Object, callback: Callback): Worker {
        this.compareObjectWorker.postMessage(transferData);
        this.compareObjectWorker.onmessage = callback;
        return this.compareObjectWorker;
    }
}

export default new WorkerManager();
