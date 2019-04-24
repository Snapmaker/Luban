import cncengine from './socket-server';
import TaskManager from './task-manager';

export configstore from './configstore';
export monitor from './monitor';


function startServices(server) {
    // Start cnc engine
    cncengine.start(server);

    TaskManager.start();
}

export default startServices;
