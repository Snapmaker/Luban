import ExportModel3dWorker from '../../workers/ExportModel3d.worker';

export const exportModel = (modelGroup, format, isBinary = true) => {
    return new Promise((resolve, reject) => {
        const worker = new ExportModel3dWorker();
        const modelGroupJson = modelGroup.toJSON();
        worker.postMessage({ modelGroupJson, format, isBinary });
        worker.onmessage = (e) => {
            const data = e.data;
            const { status, value } = data;
            switch (status) {
                case 'succeed':
                    worker.terminate();
                    resolve(value);
                    break;
                case 'err':
                    worker.terminate();
                    reject();
                    break;
                default:
                    break;
            }
        };
    });
};
