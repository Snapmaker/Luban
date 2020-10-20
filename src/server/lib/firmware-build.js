import fs from 'fs';
import path from 'path';
// import { pathWithRandomSuffix } from './random-utils';

async function firmwareAction(isMainController, filePath) {
    return new Promise((resolve, reject) => {
        let dest_filename = '';
        const version = '3.9.0';
        const date = new Date();
        const month = date.getMonth() === 0 ? 12 : date.getMonth() + 1;
        const dateString = `${date.getFullYear()}${month}${date.getDate()}`;
        if (isMainController) {
            dest_filename = `SM2_MC_APP_V${version}_${dateString}.bin`;
        } else {
            dest_filename = `SM2_EM_APP_V${version}_${dateString}.bin`;
        }
        let fullVersion = `Snapmaker_V${version}_${dateString}`;
        if (fullVersion.length < 32) {
            const diff = 32 - fullVersion.length;
            for (let i = 0; i < diff; i++) {
                fullVersion += '\x00';
            }
        }
        fullVersion += '\x00';
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
                view[0] = 0;
                view[1] = 0;
                view[2] = 0;
                view[3] = 0;
                view[4] = 0;
                for (let i = 5; i < fullVersion.length + 5; i++) {
                    view[i] = fullVersion.charCodeAt(i - 5);
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
                const newFilePath = path.join(path.dirname(filePath), dest_filename);
                fs.writeFile(newFilePath, newBuffer, (err) => {
                    console.log('succeed', newFilePath, dest_filename);
                    if (err) throw err;
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
async function packAll(filePathAndName) {
    const TYPE_MAIN_CONTROLLER = 0;
    const TYPE_EXTERNAL_MODULE = 1;
    // const TYPE_SCREEN_MODULE = 2
    async function discover_modules(filePathAndName) {
        const submodules = {};
        if (filePathAndName.length > 0) {
            for (let i = 0; i < filePathAndName.length; i++) {
                const originalPath = filePathAndName[i].newFilePath;
                const name = path.basename(originalPath);
                console.log('originalPath', originalPath, name);
                if ((/^SM2_MC_APP_V(\d+\.\d+\.\d+)_([0-9]{8}).bin$/).test(name)) {
                    submodules.MC = originalPath;
                } else if ((/^SM2_EM_APP_V(\d+\.\d+\.\d+)_([0-9]{8}).bin$/).test(name)) {
                    submodules.EM = originalPath;
                }
            }
        }
        return submodules;
    }

    async function append_head(moduleName, type, headBuffer) {
        const moduleMc = new Uint8Array(9);
        offset += 9;
        const file_path = moduleName;
        moduleMc[0] = type;
        moduleMc[1] = (offset >> 24) & 0xff;
        moduleMc[2] = (offset >> 16) & 0xff;
        moduleMc[3] = (offset >> 8) & 0xff;
        moduleMc[4] = offset & 0xff;
        fs.stat(file_path, (err, stats) => {
            const size = stats.size;
            console.log('size', size, headBuffer);
            moduleMc[5] = (size >> 24) & 0xff;
            moduleMc[6] = (size >> 16) & 0xff;
            moduleMc[7] = (size >> 8) & 0xff;
            moduleMc[8] = size & 0xff;
            const moduleMcBuffer = Buffer.from(moduleMc, 'utf-8');
            // headBuffer = Buffer.concat([headBuffer, moduleMcBuffer], headBuffer.length + moduleMcBuffer.length);
            return headBuffer;
        });
    }

    const dest_dir = path.dirname(filePathAndName[0].newFilePath);
    const dest_dirname = filePathAndName[0].fullVersion.trim();
    console.log('dest_dirname', dest_dir, dest_dirname, dest_dirname.length);
    let fullVersion = dest_dirname;
    if (fullVersion.length < 32) {
        const diff = 32 - fullVersion.length;
        for (let i = 0; i < diff; i++) {
            fullVersion += '\x00';
        }
    }
    const package_name = `${dest_dirname}.bin`;
    const package_path = path.join(dest_dir, package_name);
    const modules = discover_modules(filePathAndName);

    const count = filePathAndName.length;
    const header_size = 39 + 9 * count;
    let offset = header_size;
    const view = new Uint8Array(39);
    // Length (2 bytes)
    view[0] = (header_size >> 8) & 0xff;
    view[1] = header_size & 0xff;
    // Version (32 bytes)
    console.log('modules', modules, fullVersion.length);
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
    console.log('outside ', fullVersion, headBuffer.length);
    //  Module Header (9 bytes for each module)
    if (modules.EM) {
        // headBuffer = await append_head(modules['EM'],TYPE_EXTERNAL_MODULE,headBuffer)
        const moduleMc = new Uint8Array(9);
        const moduleName = modules.EM;
        console.log('inside 1', headBuffer.length);
        offset += 9;
        const file_path = moduleName;
        moduleMc[0] = TYPE_EXTERNAL_MODULE;
        moduleMc[1] = (offset >> 24) & 0xff;
        moduleMc[2] = (offset >> 16) & 0xff;
        moduleMc[3] = (offset >> 8) & 0xff;
        moduleMc[4] = offset & 0xff;
        await fs.stat(file_path, (err, stats) => {
            const size = stats.size;
            moduleMc[5] = (size >> 24) & 0xff;
            moduleMc[6] = (size >> 16) & 0xff;
            moduleMc[7] = (size >> 8) & 0xff;
            moduleMc[8] = size & 0xff;
            const moduleMcBuffer = Buffer.from(moduleMc, 'utf-8');
            console.log('size1 before', moduleMc, moduleMcBuffer);
            headBuffer = Buffer.concat([headBuffer, moduleMcBuffer], headBuffer.length + moduleMcBuffer.length);
            console.log('size1', headBuffer.length, moduleMcBuffer.length);
        });
    }
    if (modules.MC) {
        // headBuffer = await append_head(modules['MC'],TYPE_MAIN_CONTROLLER,headBuffer)
        const moduleMc = new Uint8Array(9);
        const moduleName = modules.MC;
        console.log('inside 2', headBuffer.length);
        offset += 9;
        const file_path = moduleName;
        moduleMc[0] = TYPE_MAIN_CONTROLLER;
        moduleMc[1] = (offset >> 24) & 0xff;
        moduleMc[2] = (offset >> 16) & 0xff;
        moduleMc[3] = (offset >> 8) & 0xff;
        moduleMc[4] = offset & 0xff;
        await fs.stat(file_path, (err, stats) => {
            const size = stats.size;
            moduleMc[5] = (size >> 24) & 0xff;
            moduleMc[6] = (size >> 16) & 0xff;
            moduleMc[7] = (size >> 8) & 0xff;
            moduleMc[8] = size & 0xff;
            const moduleMcBuffer = Buffer.from(moduleMc, 'utf-8');
            console.log('size2 before', headBuffer.length);
            headBuffer = Buffer.concat([headBuffer, moduleMcBuffer], headBuffer.length + moduleMcBuffer.length);
            console.log('size2', headBuffer.length, moduleMcBuffer.length);
        });
    }
    if (modules.EM) {
        await fs.readFile(modules.EM, (err, dataBuffer) => {
            if (err) {
                console.log(err);
            } else {
                console.log('3 before', headBuffer.length, headBuffer[headBuffer.length - 1]);
                headBuffer = Buffer.concat([headBuffer, dataBuffer], headBuffer.length + dataBuffer.length);
                console.log('3', dataBuffer.length, dataBuffer[0], headBuffer.length);
            }
        });
    }
    if (modules.MC) {
        await fs.readFile(modules.MC, (err, dataBuffer) => {
            if (err) {
                console.log(err);
            } else {
                // console.log('4 before',headBuffer.length);
                headBuffer = Buffer.concat([headBuffer, dataBuffer], headBuffer.length + dataBuffer.length);
                fs.writeFile(package_path, headBuffer, (err) => {
                    if (err) throw err;
                    console.log('4', package_path);
                    return package_path;
                });
            }
        });
    }
}

export const packFirmware = async (options) => {
    const allModules = [];
    let mainControl, externalModule;
    console.log('options', options);
    if (options.mainPath) {
        const isMainController = true;
        mainControl = firmwareAction(isMainController, options.mainPath);
    }
    if (options.modulePath) {
        const isMainController = false;
        externalModule = firmwareAction(isMainController, options.modulePath);
    }
    console.log('mainControl', mainControl, externalModule);
    Promise.all([mainControl, externalModule]).then(async (filePathAndName) => {
        console.log('filePathAndName', filePathAndName);
        const exportPath = await packAll(filePathAndName);
        return new Promise((resolve) => {
            resolve({
                filePathAndName
            });
        });
    });
};
