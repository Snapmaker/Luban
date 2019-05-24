import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { app } from 'electron';
import isElectron from 'is-electron';
import logger from './lib/logger';
import { initFonts } from './lib/FontManager';

const log = logger('server:DataStorage');


const rmDir = (dirPath, removeSelf) => {
    log.info(`Clearing folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        log.info(`Removing files: ${files}`);
    } catch (e) {
        return;
    }

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            } else {
                rmDir(filePath);
            }
        }
    }
    if (removeSelf) {
        fs.rmdirSync(dirPath);
    }
};


class DataStorage {
    static userDataDir;

    static cacheDir;

    static sessionDir;

    static configDir;

    static fontDir;

    static async init() {
        if (isElectron()) {
            this.userDataDir = app.getPath('userData');
        } else {
            this.userDataDir = './userData';
        }
        mkdirp.sync(this.userDataDir);

        this.cacheDir = `${this.userDataDir}/Cache`;
        this.sessionDir = `${this.userDataDir}/Sessions`;
        this.configDir = `${this.userDataDir}/Config`;
        this.fontDir = `${this.userDataDir}/Fonts`;

        mkdirp.sync(this.cacheDir);
        mkdirp.sync(this.sessionDir);
        rmDir(this.cacheDir, false);
        rmDir(this.sessionDir, false);

        this.initSlicer();

        await this.initFonts();
    }

    static initSlicer() {
        mkdirp.sync(this.configDir);

        const CURA_ENGINE_CONFIG_LOCAL = '../resources/CuraEngine/Config';
        if (fs.existsSync(CURA_ENGINE_CONFIG_LOCAL)) {
            const files = fs.readdirSync(CURA_ENGINE_CONFIG_LOCAL);
            for (let file of files) {
                const src = path.join(CURA_ENGINE_CONFIG_LOCAL, file);
                const dst = path.join(this.configDir, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst, () => {});
                }
            }
        }
    }

    static async initFonts() {
        mkdirp.sync(this.fontDir);

        const FONTS_LOCAL = '../resources/fonts';
        if (fs.existsSync(FONTS_LOCAL)) {
            const files = fs.readdirSync(FONTS_LOCAL);
            for (let file of files) {
                const src = path.join(FONTS_LOCAL, file);
                const dst = path.join(this.fontDir, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst, () => {});
                }
            }
        }
        await initFonts(this.fontDir);
    }
}

export default DataStorage;
