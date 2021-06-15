import SocketServer from '../lib/SocketManager';
import TaskManager from './task-manager';

import socketSerial from './socket/socket-serial';
import socketSlice from './socket/socket-slice';
import wifiServerManager from './socket/WifiServerManager';

import urljoin from '../lib/urljoin';
import settings from '../config/settings';
import * as api from './api';

export configstore from './configstore';
export monitor from './monitor';


function startServices(server) {
    // Start socket server
    const socketServer = new SocketServer();

    socketServer.on('connection', (socket) => {
        wifiServerManager.onConnection(socket);
    });

    socketServer.on('disconnection', (socket) => {
        wifiServerManager.onDisconnection(socket);
        socketSerial.onDisconnection(socket);
    });

    // slice
    socketServer.registerEvent('slice', socketSlice.handleSlice);

    // communication: http
    socketServer.registerEvent('http:discover', wifiServerManager.refreshDevices);

    // communication: serial port
    socketServer.registerEvent('serialport:list', socketSerial.serialportList);
    socketServer.registerEvent('serialport:open', socketSerial.serialportOpen);
    socketServer.registerEvent('serialport:close', socketSerial.serialportClose);
    socketServer.registerEvent('command', socketSerial.command);
    socketServer.registerEvent('writeln', socketSerial.writeln);

    // task manager
    socketServer.registerEvent('taskCommit:generateToolPath', TaskManager.addGenerateToolPathTask);
    socketServer.registerEvent('taskCommit:generateViewPath', TaskManager.addGenerateViewPathTask);
    socketServer.registerEvent('taskCommit:generateGcode', TaskManager.addGenerateGcodeTask);
    socketServer.registerEvent('taskCommit:processImage', TaskManager.addProcessImageTask);

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
    app.post(urljoin(settings.route, 'api/image/stitch'), api.image.processStitch);
    app.post(urljoin(settings.route, 'api/image/stitchEach'), api.image.processStitchEach);
    app.post(urljoin(settings.route, 'api/image/getPhoto'), api.image.processGetPhoto);
    app.post(urljoin(settings.route, 'api/image/takePhoto'), api.image.processTakePhoto);
    app.post(urljoin(settings.route, 'api/image/getCameraCalibration'), api.image.getCameraCalibrationApi);
    app.post(urljoin(settings.route, 'api/image/cameraCalibrationPhoto'), api.image.cameraCalibrationPhoto);
    app.post(urljoin(settings.route, 'api/image/setCameraCalibrationMatrix'), api.image.setCameraCalibrationMatrix);


    // Svg
    app.post(urljoin(settings.route, 'api/svg/convertRasterToSvg'), api.svg.convertRasterToSvg);
    app.post(urljoin(settings.route, 'api/svg/convertTextToSvg'), api.svg.convertTextToSvg);
    app.post(urljoin(settings.route, 'api/svg/convertOneLineTextToSvg'), api.svg.convertOneLineTextToSvg);

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

    // Macros
    app.get(urljoin(settings.route, 'api/macros'), api.macros.fetch);
    app.post(urljoin(settings.route, 'api/macros'), api.macros.create);
    app.get(urljoin(settings.route, 'api/macros/:id'), api.macros.read);
    app.put(urljoin(settings.route, 'api/macros/:id'), api.macros.update);
    app.delete(urljoin(settings.route, 'api/macros/:id'), api.macros.remove);

    // Watch
    app.get(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.post(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.get(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);
    app.post(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);

    // I18n
    app.get(urljoin(settings.route, 'api/resources/i18n/acceptedLng'), api.i18n.getAcceptedLanguage);
    app.post(urljoin(settings.route, 'api/resources/i18n/sendMissing/:lng/:ns'), api.i18n.saveMissing);

    // print3D
    app.post(urljoin(settings.route, 'api/file'), api.file.set);
    app.post(urljoin(settings.route, 'api/file/uploadCaseFile'), api.file.uploadCaseFile);
    app.post(urljoin(settings.route, 'api/file/uploadGcodeFile'), api.file.uploadGcodeFile);
    app.post(urljoin(settings.route, 'api/file/uploadUpdateFile'), api.file.uploadUpdateFile);
    app.post(urljoin(settings.route, 'api/file/buildFirmwareFile'), api.file.buildFirmwareFile);
    app.post(urljoin(settings.route, 'api/file/saveEnv'), api.file.saveEnv);
    app.post(urljoin(settings.route, 'api/file/getEnv'), api.file.getEnv);
    app.post(urljoin(settings.route, 'api/file/recoverEnv'), api.file.recoverEnv);
    app.post(urljoin(settings.route, 'api/file/removeEnv'), api.file.removeEnv);
    app.post(urljoin(settings.route, 'api/file/packageEnv'), api.file.packageEnv);
    app.post(urljoin(settings.route, 'api/file/recoverProjectFile'), api.file.recoverProjectFile);


    app.get(urljoin(settings.route, 'api/printingQualityDefinitions/:series'), api.printingConfigs.getQualityDefinitions);
    app.get(urljoin(settings.route, 'api/printingMaterialDefinitions'), api.printingConfigs.getMaterialDefinitions);
    app.get(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.getDefinition);
    app.get(urljoin(settings.route, 'api/printingRawDefinition/:definitionId'), api.printingConfigs.getRawDefinition);
    app.post(urljoin(settings.route, 'api/printingDefinition'), api.printingConfigs.createDefinition);
    app.delete(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.removeDefinition);
    app.put(urljoin(settings.route, 'api/printingDefinition/:definitionId'), api.printingConfigs.updateDefinition);
    app.post(urljoin(settings.route, 'api/printingDefinition/upload'), api.printingConfigs.uploadDefinition);

    app.get(urljoin(settings.route, 'api/cncToolDefinitions'), api.cncConfigs.getToolDefinitions);

    app.get(urljoin(settings.route, 'api/cncToolListDefinition/:definitionId'), api.cncConfigs.getToolListDefinition);
    app.post(urljoin(settings.route, 'api/cncToolListDefinition'), api.cncConfigs.createToolListDefinition);
    app.delete(urljoin(settings.route, 'api/cncToolListDefinition'), api.cncConfigs.removeToolListDefinition);
    app.post(urljoin(settings.route, 'api/cncToolDefinitions/upload'), api.cncConfigs.uploadToolDefinition);
    app.post(urljoin(settings.route, 'api/cncToolListDefinition/:definitionId'), api.cncConfigs.changeActiveToolListDefinition);

    app.put(urljoin(settings.route, 'api/cncToolDefinitions/update'), api.cncConfigs.updateToolDefinition);
}

export {
    startServices,
    registerApis
};
