import SocketServer from '../lib/ServerManager/SocketServer';
import TaskManager from './task-manager';
import * as socketEvent from './socket';
import serverManager from '../lib/ServerManager';
import urljoin from '../lib/urljoin';
import settings from '../config/settings';
import * as api from './api';

export configstore from './configstore';
export monitor from './monitor';


function startServices(server) {
    // Start socket server
    const socketServer = new SocketServer();

    serverManager.on('servers', (servers) => {
        for (const socket of socketServer.sockets) {
            socket.emit('http:discover', servers);
        }
    });

    socketServer.registerConnectionEvent(['slice', socketEvent.slice.slice3DP]);

    socketServer.registerConnectionEvent(['http:discover', socketEvent.wifi.httpDiscover]);

    socketServer.registerConnectionEvent(['command', socketEvent.serial.command]);
    socketServer.registerConnectionEvent(['writeln', socketEvent.serial.writeln]);
    socketServer.registerConnectionEvent(['serialport:list', socketEvent.serial.serialportList]);
    socketServer.registerConnectionEvent(['serialport:open', socketEvent.serial.serialportOpen]);
    socketServer.registerConnectionEvent(['serialport:close', socketEvent.serial.serialportClose]);

    socketServer.registerDisconnectEvent(socketEvent.serial.disconnect);

    socketServer.registerConnectionEvent(['task:commit', TaskManager.taskCommit]);
    socketServer.registerConnectionEvent(TaskManager.onConnection);


    socketServer.start(server);

    // Start task manager
    TaskManager.start();
}

function registerApis(app) {
    app.post(urljoin(settings.route, 'api/signin'), api.users.signin);


    // Register API routes with authorized access
    // Version
    app.get(urljoin(settings.route, 'api/version/latest'), api.version.getLatestVersion);

    // Utils
    app.get(urljoin(settings.route, 'api/utils/platform'), api.utils.getPlatform);
    app.get(urljoin(settings.route, 'api/utils/fonts'), api.utils.getFonts);
    app.post(urljoin(settings.route, 'api/utils/font'), api.utils.uploadFont);

    // State
    app.get(urljoin(settings.route, 'api/state'), api.state.get);
    app.post(urljoin(settings.route, 'api/state'), api.state.set);
    app.delete(urljoin(settings.route, 'api/state'), api.state.unset);

    // G-code
    app.get(urljoin(settings.route, 'api/gcode'), api.gcode.get);
    app.post(urljoin(settings.route, 'api/gcode'), api.gcode.set);
    app.get(urljoin(settings.route, 'api/gcode/download'), api.gcode.download);

    // Controllers
    app.get(urljoin(settings.route, 'api/controllers'), api.controllers.get);

    // Image
    app.post(urljoin(settings.route, 'api/image'), api.image.set);
    app.post(urljoin(settings.route, 'api/image/process'), api.image.process);
    app.post(urljoin(settings.route, 'api/image/stock'), api.image.stockRemapProcess);
    app.post(urljoin(settings.route, 'api/image/trace'), api.image.processTrace);

    // Svg
    app.post(urljoin(settings.route, 'api/svg/convertRasterToSvg'), api.svg.convertRasterToSvg);
    app.post(urljoin(settings.route, 'api/svg/convertTextToSvg'), api.svg.convertTextToSvg);

    // ToolPath
    app.post(urljoin(settings.route, 'api/toolpath/generate'), api.toolpath.generate);

    // Commands
    // app.get(urljoin(settings.route, 'api/commands'), api.commands.fetch);
    // app.post(urljoin(settings.route, 'api/commands'), api.commands.create);
    // app.get(urljoin(settings.route, 'api/commands/:id'), api.commands.read);
    // app.put(urljoin(settings.route, 'api/commands/:id'), api.commands.update);
    // app.delete(urljoin(settings.route, 'api/commands/:id'), api.commands.__delete);
    // app.post(urljoin(settings.route, 'api/commands/run/:id'), api.commands.run);

    // Events
    // app.get(urljoin(settings.route, 'api/events'), api.events.fetch);
    // app.post(urljoin(settings.route, 'api/events/'), api.events.create);
    // app.get(urljoin(settings.route, 'api/events/:id'), api.events.read);
    // app.put(urljoin(settings.route, 'api/events/:id'), api.events.update);
    // app.delete(urljoin(settings.route, 'api/events/:id'), api.events.__delete);

    // Users
    // app.get(urljoin(settings.route, 'api/users'), api.users.fetch);
    // app.post(urljoin(settings.route, 'api/users/'), api.users.create);
    // app.get(urljoin(settings.route, 'api/users/:id'), api.users.read);
    // app.put(urljoin(settings.route, 'api/users/:id'), api.users.update);
    // app.delete(urljoin(settings.route, 'api/users/:id'), api.users.__delete);

    // Watch
    app.get(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.post(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.get(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);
    app.post(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);

    // I18n
    app.get(urljoin(settings.route, 'api/i18n/acceptedLng'), api.i18n.getAcceptedLanguage);
    app.post(urljoin(settings.route, 'api/i18n/sendMissing/:lng/:ns'), api.i18n.saveMissing);

    // print3D
    app.post(urljoin(settings.route, 'api/file'), api.file.set);

    app.get(urljoin(settings.route, 'api/printingDefinitionsByType/:type'), api.printingConfigs.getDefinitionsByType);
    app.get(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.getDefinition);
    app.post(urljoin(settings.route, 'api/printingDefinition'), api.printingConfigs.createDefinition);
    app.delete(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.removeDefinition);
    app.put(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.updateDefinition);
}

export {
    startServices,
    registerApis
};
