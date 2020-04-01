import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { app } from 'electron';
import isElectron from 'is-electron';
import semver from 'semver';
import logger from './lib/logger';
import { initFonts } from './lib/FontManager';
import settings from './config/settings';


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
            const filePath = `${dirPath}/${files[i]}`;
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

    static sessionDir;

    static tmpDir;

    static configDir;

    static fontDir;

    static userCaseDir;

    static async init() {
        if (isElectron()) {
            this.userDataDir = app.getPath('userData');
        } else {
            this.userDataDir = './userData';
        }
        mkdirp.sync(this.userDataDir);

        this.sessionDir = `${this.userDataDir}/Sessions`;
        this.tmpDir = `${this.userDataDir}/Tmp`;
        this.configDir = `${this.userDataDir}/Config`;
        this.fontDir = `${this.userDataDir}/Fonts`;
        this.userCaseDir = `${this.userDataDir}/UserCase`;

        mkdirp.sync(this.tmpDir);
        mkdirp.sync(this.sessionDir);
        rmDir(this.tmpDir, false);
        rmDir(this.sessionDir, false);

        this.initSlicer();

        await this.initFonts();
        await this.initUserCase();
        await this.versionAdaptation();
    }

    static async initSlicer() {
        mkdirp.sync(this.configDir);

        const CURA_ENGINE_CONFIG_LOCAL = '../resources/CuraEngine/Config';
        if (fs.existsSync(CURA_ENGINE_CONFIG_LOCAL)) {
            const files = fs.readdirSync(CURA_ENGINE_CONFIG_LOCAL);
            for (const file of files) {
                const src = path.join(CURA_ENGINE_CONFIG_LOCAL, file);
                const dst = path.join(this.configDir, file);
                if (fs.statSync(src)
                    .isFile()) {
                    fs.copyFileSync(src, dst, () => {
                    });
                } else {
                    const srcPath = `${CURA_ENGINE_CONFIG_LOCAL}/${file}`;
                    const dstPath = `${this.configDir}/${file}`;
                    await this.copyDir(srcPath, dstPath);
                }
            }
        }
    }

    static async initFonts() {
        mkdirp.sync(this.fontDir);

        const FONTS_LOCAL = '../resources/fonts';
        if (fs.existsSync(FONTS_LOCAL)) {
            const files = fs.readdirSync(FONTS_LOCAL);
            for (const file of files) {
                const src = path.join(FONTS_LOCAL, file);
                const dst = path.join(this.fontDir, file);
                if (fs.statSync(src)
                    .isFile()) {
                    fs.copyFileSync(src, dst, () => {
                    });
                }
            }
        }
        await initFonts(this.fontDir);
    }

    static async initUserCase() {
        mkdirp.sync(this.userCaseDir);

        const USER_CASE_LOCAL = '../resources/user-case';
        if (fs.existsSync(USER_CASE_LOCAL)) {
            const files = fs.readdirSync(USER_CASE_LOCAL);
            for (const file of files) {
                const src = path.join(USER_CASE_LOCAL, file);
                const dst = path.join(this.userCaseDir, file);
                if (fs.statSync(src)
                    .isFile()) {
                    fs.copyFileSync(src, dst);
                } else {
                    const srcPath = `${USER_CASE_LOCAL}/${file}`;
                    const dstPath = `${this.userCaseDir}/${file}`;
                    await this.copyDir(srcPath, dstPath);
                }
            }
        }
    }

    static async copyDir(src, dst) {
        mkdirp.sync(dst);

        if (fs.existsSync(src)) {
            const files = fs.readdirSync(src);
            for (const file of files) {
                const srcPath = path.join(src, file);
                const dstPath = path.join(dst, file);
                if (fs.statSync(srcPath)
                    .isFile()) {
                    fs.copyFileSync(srcPath, dstPath);
                }
            }
        }
    }

    static async copyFile(src, dst, isCover = true) {
        if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
            return;
        }
        if (!isCover && fs.existsSync(dst)) {
            return;
        }
        fs.copyFileSync(src, dst);
    }

    static async versionAdaptation() {
        if (semver.gte(settings.version, '3.3.0')) {
            log.info(settings.version);
            const files = fs.readdirSync(this.configDir);
            for (const file of files) {
                if (file.indexOf('quality') !== -1) {
                    const src = path.join(this.configDir, file);
                    const dstA150 = path.join(`${this.configDir}/A150`, file);
                    const dstA250 = path.join(`${this.configDir}/A250`, file);
                    const dstA350 = path.join(`${this.configDir}/A350`, file);
                    await this.copyFile(src, dstA150, false);
                    await this.copyFile(src, dstA250, false);
                    await this.copyFile(src, dstA350, false);
                }
            }
        }
    }
}

export default DataStorage;
