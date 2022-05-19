import SocketServer from '../lib/SocketManager';
import TaskManager from './task-manager';

import socketSerial from './socket/socket-serial';
import socketSlice from './socket/socket-slice';
import connectionManager from './socket/ConnectionManager';

import urljoin from '../lib/urljoin';
import settings from '../config/settings';
import * as api from './api';

import configstore from './configstore';
import monitor from './monitor';

export {
    configstore,
    monitor
};
const connectionEventsObject = {
    'connection:open': connectionManager.connectionOpen,
    'connection:close': connectionManager.connectionClose,
    'connection:startGcode': connectionManager.startGcode,
    'connection:resumeGcode': connectionManager.resumeGcode,
    'connection:pauseGcode': connectionManager.pauseGcode,
    'connection:stopGcode': connectionManager.stopGcode,
    'connection:executeGcode': connectionManager.executeGcode,
    'connection:startHeartbeat': connectionManager.startHeartbeat,
    'connection:getGcodeFile': connectionManager.getGcodeFile,
    'connection:uploadFile': connectionManager.uploadFile,
    'connection:updateNozzleTemperature': connectionManager.updateNozzleTemperature,
    'connection:updateBedTemperature': connectionManager.updateBedTemperature,
    'connection:updateZOffset': connectionManager.updateZOffset,
    'connection:loadFilament': connectionManager.loadFilament,
    'connection:unloadFilament': connectionManager.unloadFilament,
    'connection:updateWorkSpeedFactor': connectionManager.updateWorkSpeedFactor,
    'connection:updateLaserPower': connectionManager.updateLaserPower,
    'connection:switchLaserPower': connectionManager.switchLaserPower,
    'connection:materialThickness': connectionManager.getLaserMaterialThickness,
    'connection:setEnclosureLight': connectionManager.setEnclosureLight,
    'connection:setEnclosureFan': connectionManager.setEnclosureFan,
    'connection:setDoorDetection': connectionManager.setDoorDetection,
    'connection:setFilterSwitch': connectionManager.setFilterSwitch,
    'connection:setFilterWorkSpeed': connectionManager.setFilterWorkSpeed,
    'connection:materialThickness_abort': connectionManager.abortLaserMaterialThickness,
    'connection:goHome': connectionManager.goHome,
    'connection:coordinateMove': connectionManager.coordinateMove,
    'connection:setWorkOrigin': connectionManager.setWorkOrigin,
    'connection:updateToolHeadSpeed': connectionManager.updateToolHeadSpeed, // CNC, FOR NOW
    'connection:switchCNC': connectionManager.switchCNC, // CNC, FOR NOW
    'connection:updateWorkNozzle': connectionManager.switchExtruder,
};

function startServices(server) {
    // Start socket server
    const socketServer = new SocketServer();

    socketServer.on('connection', connectionManager.onConnection);

    socketServer.on('disconnection', connectionManager.onDisconnection);

    // slice
    socketServer.registerEvent('slice', socketSlice.handleSlice);
    socketServer.registerEvent('generate-support', socketSlice.handleGenerateSupport);

    // communication: http & serial port
    socketServer.registerEvent('machine:discover', connectionManager.refreshDevices);


    // socketServer.registerEvent('serialport:close', socketSerial.serialportClose);
    socketServer.registerEvent('command', socketSerial.command);
    socketServer.registerEvent('writeln', socketSerial.writeln);
    Object.entries(connectionEventsObject).forEach(([key, value]) => {
        socketServer.registerEvent(key, value);
    });

    // task manager
    socketServer.registerEvent('taskCommit:generateToolPath', TaskManager.addGenerateToolPathTask);
    socketServer.registerEvent('taskCommit:generateViewPath', TaskManager.addGenerateViewPathTask);
    socketServer.registerEvent('taskCommit:generateGcode', TaskManager.addGenerateGcodeTask);
    socketServer.registerEvent('taskCommit:processImage', TaskManager.addProcessImageTask);
    socketServer.registerEvent('taskCommit:cutModel', TaskManager.addCutModelTask);

    socketServer.registerEvent('taskCancel:cutModel', TaskManager.cancelTask);

    socketServer.start(server);
}

function registerApis(app) {
    app.post(urljoin(settings.route, 'api/signin'), api.users.signin);
    app.delete(urljoin(settings.route, 'api/user/resetConfig'), api.users.resetConfig);

    // backup by user
    app.put(urljoin(settings.route, 'api/user/backup'), api.users.longTermBackupConfig);

    // check new user
    app.get(urljoin(settings.route, 'api/checkNewUser'), api.users.checkNewUser);

    // Register API routes with authorized access
    // Version
    // deprecated?
    app.get(urljoin(settings.route, 'api/version/latest'), api.version.getLatestVersion);

    // Utils
    app.get(urljoin(settings.route, 'api/utils/platform'), api.utils.getPlatform); // deprecated?
    app.get(urljoin(settings.route, 'api/utils/fonts'), api.utils.getFonts);
    app.post(urljoin(settings.route, 'api/utils/font'), api.utils.uploadFont);

    // State
    // depecated?
    app.get(urljoin(settings.route, 'api/state'), api.state.get);
    app.post(urljoin(settings.route, 'api/state'), api.state.set);
    app.delete(urljoin(settings.route, 'api/state'), api.state.unset);

    // G-code
    app.get(urljoin(settings.route, 'api/gcode'), api.gcode.get); // deprecated?
    app.post(urljoin(settings.route, 'api/gcode'), api.gcode.set);
    app.get(urljoin(settings.route, 'api/gcode/download'), api.gcode.download); // deprecated?

    // Controllers
    app.get(urljoin(settings.route, 'api/controllers'), api.controllers.get); // deprecated?

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
    app.post(urljoin(settings.route, 'api/svg/convertRasterToSvg'), api.svg.convertRasterToSvg); // deprecated?
    app.post(urljoin(settings.route, 'api/svg/convertTextToSvg'), api.svg.convertTextToSvg);
    app.post(urljoin(settings.route, 'api/svg/convertOneLineTextToSvg'), api.svg.convertOneLineTextToSvg); // deprecated?

    // ToolPath
    app.post(urljoin(settings.route, 'api/toolpath/generate'), api.toolpath.generate); // deprecated?

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
    // deprecated?
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


    app.get(urljoin(settings.route, 'api/profileRawDefinition/:headType/:definitionId'), api.profileDefinitions.getRawDefinition);

    app.get(urljoin(settings.route, 'api/getDefinitionsByPrefixName/:headType/:prefix/:series'), api.profileDefinitions.getDefinitionsByPrefixName);
    app.get(urljoin(settings.route, 'api/profileDefaultDefinitions/:headType/:series'), api.profileDefinitions.getDefaultDefinitions);
    app.get(urljoin(settings.route, 'api/profileConfigDefinitions/:headType/:series'), api.profileDefinitions.getConfigDefinitions);
    app.get(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId/'), api.profileDefinitions.getDefinition);
    app.post(urljoin(settings.route, 'api/profileDefinition/:headType'), api.profileDefinitions.createDefinition);
    app.post(urljoin(settings.route, 'api/profileTmpDefinition'), api.profileDefinitions.createTmpDefinition);
    app.delete(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId'), api.profileDefinitions.removeDefinition);
    app.put(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId'), api.profileDefinitions.updateDefinition);
    app.post(urljoin(settings.route, 'api/profileDefinition/:headType/upload'), api.profileDefinitions.uploadDefinition);
}

export {
    startServices,
    registerApis
};
