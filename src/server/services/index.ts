import settings from '../config/settings';
import SocketServer from '../lib/SocketManager';
import urljoin from '../lib/urljoin';
import * as api from './api';
import * as meshHandlers from './channel-handlers/mesh';
import configstore from './configstore';
import { connectionManager } from './machine/ConnectionManager';
import { textSerialChannel } from './machine/channels/TextSerialChannel';
import monitor from './monitor';
import { register as registerDiscoverHandlers } from './socket/discover-handlers';
import { register as registerMachineHandlers } from './socket/machine-handlers';
import { register as registerOSHandlers } from './socket/os-handlers';
import socketSlice from './socket/socket-slice';
import system from './socket/system';
import TaskManager from './task-manager';


function startServices(server) {
    // Start socket server
    const socketServer = new SocketServer();


    // ===============
    // OS
    // ===============
    registerOSHandlers(socketServer);

    // slice
    socketServer.registerEvent('slice', socketSlice.handleSlice);
    socketServer.registerEvent('generate-support', socketSlice.handleGenerateSupport);

    // simplify model
    socketServer.registerEvent('simplify-model', socketSlice.handleSimplifyModel);
    // repair model
    socketServer.registerChannel('repair-model', socketSlice.handleRepairModel);
    socketServer.registerChannel('check-model', socketSlice.handleCheckModel);
    // split model
    socketServer.registerChannel('mesh:split', meshHandlers.handleSplitMesh);

    // ===============
    // Machine Discover
    // ===============
    registerDiscoverHandlers(socketServer);

    // ===============
    // machine control: http & serial port
    // ===============
    // Register machine control handlers
    registerMachineHandlers(socketServer);

    socketServer.on('connection', connectionManager.onConnection);
    socketServer.on('disconnection', connectionManager.onDisconnection);

    // TODO: refactor these 2 API
    socketServer.registerEvent('command', textSerialChannel.command);
    socketServer.registerEvent('writeln', textSerialChannel.writeln);

    // task manager
    socketServer.registerEvent('taskCommit:generateToolPath', TaskManager.addGenerateToolPathTask);
    socketServer.registerEvent('taskCommit:generateViewPath', TaskManager.addGenerateViewPathTask);
    socketServer.registerEvent('taskCommit:generateGcode', TaskManager.addGenerateGcodeTask);
    socketServer.registerEvent('taskCommit:processImage', TaskManager.addProcessImageTask);
    socketServer.registerEvent('taskCommit:svgClipping', TaskManager.addSVGClipping);
    socketServer.registerEvent('taskCommit:cutModel', TaskManager.addCutModelTask);
    socketServer.registerEvent('taskCancel:cutModel', TaskManager.cancelTask);

    socketServer.registerChannel('get-free-memory', system.getSystemFreeMemorySize);

    socketServer.start(server);
}

function registerApis(app) {
    app.post(urljoin(settings.route, 'api/signin'), api.users.signin);
    app.delete(urljoin(settings.route, 'api/user/resetConfig'), api.users.resetConfig);
    app.delete(urljoin(settings.route, 'api/user/resetConfig/printing'), api.users.resetPrintConfig);

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
    app.post(urljoin(settings.route, 'api/image/stock'), api.image.stockRemapProcess);
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

    app.get(urljoin(settings.route, 'api/file/getEnv'), api.file.getEnv);
    app.post(urljoin(settings.route, 'api/file/saveEnv'), api.file.saveEnv);
    app.post(urljoin(settings.route, 'api/file/recoverEnv'), api.file.recoverEnv);
    app.post(urljoin(settings.route, 'api/file/removeEnv'), api.file.removeEnv);
    app.post(urljoin(settings.route, 'api/file/packageEnv'), api.file.packageEnv);
    app.post(urljoin(settings.route, 'api/file/recoverProjectFile'), api.file.recoverProjectFile);


    app.get(urljoin(settings.route, 'api/profileRawDefinition/:headType/:definitionId'), api.profileDefinitions.getRawDefinition);

    app.get(urljoin(settings.route, 'api/getDefinitionsByPrefixName/:headType/:prefix'), api.profileDefinitions.getDefinitionsByPrefixName);
    app.get(urljoin(settings.route, 'api/profileDefaultDefinitions/:headType'), api.profileDefinitions.getDefaultDefinitions);
    app.get(urljoin(settings.route, 'api/profileConfigDefinitions/:headType'), api.profileDefinitions.getConfigDefinitions);

    app.put(urljoin(settings.route, 'api/profileDefaultDefinition/:headType/:definitionId'), api.profileDefinitions.updateDefaultDefinition);

    app.get(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId/'), api.profileDefinitions.getDefinition);
    app.post(urljoin(settings.route, 'api/profileDefinition/:headType'), api.profileDefinitions.createDefinition);

    app.delete(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId'), api.profileDefinitions.removeDefinition);
    app.put(urljoin(settings.route, 'api/profileDefinition/:headType/:definitionId'), api.profileDefinitions.updateDefinition);
    app.post(urljoin(settings.route, 'api/profileDefinition/:headType/upload'), api.profileDefinitions.uploadDefinition);

    app.post(urljoin(settings.route, 'api/profileTmpDefinition'), api.profileDefinitions.createTmpDefinition);

    // preset
    app.get(urljoin(settings.route, 'api/preset/parameter_keys'), api.profileDefinitions.getPresetParameterKeys);

    // parameter
    app.get(urljoin(settings.route, 'api/parameter-document/:category/:key'), api.profileDefinitions.getParameterDoc);

    // case resources
    app.get(urljoin(settings.route, 'api/case-resources/case-list'), api.onlineResourcesService.getCaseList);

    // svg shape library
    app.get(urljoin(settings.route, 'api/svg-shape/list'), api.onlineResourcesService.getSvgShapeList);
    app.get(urljoin(settings.route, 'api/svg-shape-label/list'), api.onlineResourcesService.getSvgShapeLabelList);

    app.get(urljoin(settings.route, 'api/information-flow'), api.onlineResourcesService.getInformationFlowData);
}

export {
    configstore,
    monitor, registerApis, startServices
};

