import fs from 'fs';
import path from 'path';
import DataStorage from '../DataStorage';

async function firmwareAction(isMainController, filePath, version) {
    return new Promise((resolve) => {
        let destFilename = '';
        const date = new Date();
        const month = date.getMonth() === 0 ? 12 : date.getMonth() + 1;
        const day = String(date.getDate()).length === 1 ? `0${date.getDate()}` : date.getDate();
        const dateString = `${date.getFullYear()}${month}${day}`;
        if (isMainController) {
            destFilename = `SM2_MC_APP_V${version}_${dateString}.bin`;
        } else {
            destFilename = `SM2_EM_APP_V${version}_${dateString}.bin`;
        }
        // TODO Improve 'fullVersion' and 'packFullVersion' to the same !!!
        const fullVersion = `Snapmaker2_V${version}_${dateString}`;
        let packFullVersion = `Snapmaker_V${version}_${dateString}`;
        if (packFullVersion.length < 32) {
            const diff = 32 - packFullVersion.length;
            for (let i = 0; i < diff; i++) {
                packFullVersion += '\x00';
            }
        }
        packFullVersion += '\x00';
        let checksum = 0;
        let dataBuffer;
        fs.readFile(filePath, (err, data) => {
            if (err) {
                throw err;
            } else {
                data.forEach((item) => {
                    checksum = (item + checksum) & 0xFFFFFFF;
                });
                dataBuffer = data;
                const dataBufferLength = dataBuffer.length;
                const view = new Uint8Array(2048);
                // string
                if (isMainController) {
                    view[0] = 0;
                } else {
                    view[0] = 1;
                }
                view[1] = 0;
                view[2] = 0;
                view[3] = 0;
                view[4] = 0;
                for (let i = 5; i < packFullVersion.length + 5; i++) {
                    view[i] = packFullVersion.charCodeAt(i - 5);
                }
                view[38] = 0;
                view[39] = 0;
                view[40] = dataBufferLength & 0xff;
                view[41] = (dataBufferLength >> 8) & 0xff;
                view[42] = (dataBufferLength >> 16) & 0xff;
                view[43] = (dataBufferLength >> 24) & 0xff;

                view[44] = checksum & 0xff;
                view[45] = (checksum >> 8) & 0xff;
                view[46] = (checksum >> 16) & 0xff;
                view[47] = (checksum >> 24) & 0xff;

                const headBuffer = Buffer.from(view, 'utf-8');
                const newBuffer = Buffer.concat([headBuffer, dataBuffer], headBuffer.length + dataBuffer.length);
                const newFilePath = path.join(path.dirname(filePath), destFilename);
                fs.writeFile(newFilePath, newBuffer, (error) => {
                    if (error) throw error;
                    resolve({
                        newFilePath,
                        fullVersion
                    });
                });
            }
        });
    });
}
/*
    filePathAndName: {
        newFilePath,
        fullVersion
    }
*/
function packAll(filePathAndName) {
    const TYPE_MAIN_CONTROLLER = 0;
    const TYPE_EXTERNAL_MODULE = 1;
    // const TYPE_SCREEN_MODULE = 2
    function discoverModules(filePaths) {
        const submodules = {};
        if (filePaths.length > 0) {
            for (let i = 0; i < filePaths.length; i++) {
                if (filePaths[i]) {
                    const originalPath = filePaths[i].newFilePath;
                    const name = path.basename(originalPath);
                    if ((/^SM2_MC_APP_V(\d+\.\d+\.\d+)_([0-9]{8}).bin$/).test(name)) {
                        submodules.MC = originalPath;
                    } else if ((/^SM2_EM_APP_V(\d+\.\d+\.\d+)_([0-9]{8}).bin$/).test(name)) {
                        submodules.EM = originalPath;
                    }
                }
            }
        }
        return submodules;
    }

    function appendHead(moduleName, type, headBuffer, offset) {
        const moduleMc = new Uint8Array(9);
        const filePath = moduleName;
        moduleMc[0] = type;
        moduleMc[1] = (offset >> 24) & 0xff;
        moduleMc[2] = (offset >> 16) & 0xff;
        moduleMc[3] = (offset >> 8) & 0xff;
        moduleMc[4] = offset & 0xff;
        offset += 9;
        const stats = fs.statSync(filePath);
        const size = stats.size;
        moduleMc[5] = (size >> 24) & 0xff;
        moduleMc[6] = (size >> 16) & 0xff;
        moduleMc[7] = (size >> 8) & 0xff;
        moduleMc[8] = size & 0xff;
        const moduleMcBuffer = Buffer.from(moduleMc, 'utf-8');
        return Buffer.concat([headBuffer, moduleMcBuffer], headBuffer.length + moduleMcBuffer.length);
    }

    const destName = filePathAndName[0].fullVersion;
    let fullVersion = destName;
    if (fullVersion.length < 32) {
        const diff = 32 - fullVersion.length;
        for (let i = 0; i < diff; i++) {
            fullVersion += '\x00';
        }
    }
    const packageName = `${destName}.bin`;
    // const packagePath = path.join(destDir, packageName);
    const modules = discoverModules(filePathAndName);

    const count = filePathAndName.length;
    const headerSize = 39 + 9 * count;
    const offset = headerSize;
    const view = new Uint8Array(39);
    // Length (2 bytes)
    view[0] = (headerSize >> 8) & 0xff;
    view[1] = headerSize & 0xff;
    // Version (32 bytes)
    for (let i = 2; i < fullVersion.length + 2; i++) {
        view[i] = fullVersion.charCodeAt(i - 2);
    }
    // Flag (4 bytes)
    view[34] = 0;
    view[35] = 0;
    view[36] = 0;
    view[37] = 0;
    // Count (1 byte)
    view[38] = count;
    let headBuffer = Buffer.from(view, 'utf-8');
    //  Module Header (9 bytes for each module)
    if (modules.EM) {
        headBuffer = appendHead(modules.EM, TYPE_EXTERNAL_MODULE, headBuffer, offset);
    }
    if (modules.MC) {
        headBuffer = appendHead(modules.MC, TYPE_MAIN_CONTROLLER, headBuffer, offset);
    }
    if (modules.EM) {
        const dataBuffer = fs.readFileSync(modules.EM);
        headBuffer = Buffer.concat([headBuffer, dataBuffer], headBuffer.length + dataBuffer.length);
    }
    if (modules.MC) {
        const dataBuffer = fs.readFileSync(modules.MC);
        headBuffer = Buffer.concat([headBuffer, dataBuffer], headBuffer.length + dataBuffer.length);
    }
    return {
        headBuffer,
        packageName
    };
}

export const packFirmware = async (options) => {
    const allModules = [];
    if (options.mainPath) {
        const isMainController = true;
        allModules.push(await firmwareAction(isMainController, options.mainPath, options.buildVersion));
    }
    if (options.modulePath) {
        const isMainController = false;
        allModules.push(await firmwareAction(isMainController, options.modulePath, options.buildVersion));
    }
    return Promise.all(allModules).then((filePathAndName) => {
        const { packageName, headBuffer } = packAll(filePathAndName);
        const packagePath = `${DataStorage.tmpDir}/${packageName}`;
        return new Promise((resolve) => {
            fs.writeFile(packagePath, headBuffer, (err) => {
                if (err) throw err;
                resolve({
                    packageName
                });
            });
        });
    });
};
