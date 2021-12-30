const EvaluateSupportArea = require('../../workers/EvaluateSupportArea.worker');

type Callback = (event: MessageEvent<any>) => any;
class WorkerManager {
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
}

export default new WorkerManager();
