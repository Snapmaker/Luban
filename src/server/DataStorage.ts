import * as fs from 'fs-extra';
import isElectron from 'is-electron';
import { gt, isNil, isUndefined } from 'lodash';
import path, { join } from 'path';
import { v4 as uuid } from 'uuid';

import pkg from '../../package.json';
import { DEFAULT_FONT_NAME, initFonts } from '../shared/lib/FontManager';
import settings from './config/settings';
import { CNC_CONFIG_SUBCATEGORY, LASER_CONFIG_SUBCATEGORY, PRINTING_CONFIG_SUBCATEGORY } from './constants';
import downloadManager from './lib/downloadManager';
import logger from './lib/logger';
import { copyDir } from './lib/util-fs/node';
import config from './services/configstore';

const log = logger('server:DataStorage');

export const rmDir = (dirPath: string, removeSelf = true) => {
    log.info(`Clearing folder ${dirPath}`);

    let files: string[];
    try {
        files = fs.readdirSync(dirPath);
    } catch (e) {
        log.error(`Read directory fail ${dirPath}`);
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

/**
 * Ensure directory is empty.
 */
const emptyDir = async (dirPath: string) => {
    log.info(`Clearing folder ${dirPath}`);

    try {
        await fs.emptyDir(dirPath);
    } catch (e) {
        log.error(e);
    }
};

/**
 * Remove a directory.
 */
/*
const removeDir = async (dirPath: string) => {
    log.info(`Removing folder ${dirPath}`);

    try {
        await fs.remove(dirPath);
    } catch (e) {
        log.error(e);
    }
};
*/

class DataStorage {
    public userDataDir = null;
    public sessionDir: string;
    public tmpDir: string;
    public configDir: string;
    public defaultConfigDir: string;
    public fontDir: string;
    public scenesDir: string;
    public userCaseDir: string;
    public envDir: string;
    private recoverDir: string;
    private longTermConfigDir: string;
    private activeConfigDir: string;

    private parameterDocumentDir = null;

    // @ts-ignore
    private initialized = false;

    public constructor() {
        if (isElectron()) {
            // TODO: Refactor this
            this.userDataDir = global.luban.userDataDir;
            // this.userDataDir = process.env.USER_DATA_DIR;
        } else {
            this.userDataDir = path.resolve('./');
        }

        log.info(`Initialize data storage at directory: ${this.userDataDir}`);
        fs.ensureDir(this.userDataDir);

        this.sessionDir = `${this.userDataDir}/Sessions`;
        this.userCaseDir = `${this.userDataDir}/UserCase`;
        this.tmpDir = `${this.userDataDir}/Tmp`;
        this.configDir = `${this.userDataDir}/Config`;
        this.defaultConfigDir = `${this.userDataDir}/Default`;
        this.fontDir = `${this.userDataDir}/Fonts`;
        this.envDir = `${this.userDataDir}/env`;
        this.scenesDir = `${this.userDataDir}/Scenes`;
        this.recoverDir = `${this.userDataDir}/snapmaker-recover`;
        this.activeConfigDir = `${this.recoverDir}/Config-active`;
        this.longTermConfigDir = '';

        // parameters
        this.parameterDocumentDir = `${this.userDataDir}/print-parameter-docs`;
    }

    public resolveRelativePath(pathString) {
        const regex = new RegExp(/^\.\//);
        if (isElectron() && regex.test(pathString)) {
            pathString = path.resolve(this.userDataDir, pathString);
        }
        return pathString;
    }

    private async _initBasicStorage(): Promise<void> {
        await fs.ensureDir(this.tmpDir);
        await fs.ensureDir(this.sessionDir);
    }

    /**
     * Initialize Data Storage.
     *
     * Pass reset=true to reset all user configurations.
     */
    public async init(reset = false): Promise<void> {
        // TODO: Refactor this
        const gaUserId = config.get('gaUserId');
        if (isNil(gaUserId)) {
            config.set('gaUserId', uuid());
        }

        await this._initBasicStorage();

        await fs.ensureDir(this.userCaseDir);
        await fs.ensureDir(this.scenesDir);
        !reset && fs.ensureDir(this.recoverDir);

        await this.clearSession();

        // prepare directories
        !reset && await this.checkNewUser();

        let overwriteProfiles = false;
        // upgrade to new version
        // TODO: remove key 'DefinitionUpdated'
        const definitionVersion = config.get('definitionVersion');
        if (definitionVersion !== settings.version) {
            overwriteProfiles = true;

            config.set('definitionVersion', settings.version);
        }
        // configDir not existing
        if (!overwriteProfiles && !fs.existsSync(this.configDir)) {
            overwriteProfiles = true;
        }
        if (config.has('DefinitionUpdated')) {
            config.unset('DefinitionUpdated');
        }

        await fs.ensureDir(this.configDir);

        await this.initLongTermRecover(reset);
        await this.initEnv();

        await this.initFonts();
        await this.initScenes();

        if (reset || overwriteProfiles) {
            await this.initParameters();
            await this.initParameterDocumentDir();
            await this.initProfileDocs();
            await this.initUserCase();

            await this.initLaserResources();
        }

        // upgrade and validate parameter config files
        this.upgradeConfigFile(this.configDir);

        // if alt+shift+r, cannot init recover config
        if (!reset) {
            await this.initRecoverActive();
        }

        this.initialized = true;
    }

    public getParameterDocumentDir() {
        return this.parameterDocumentDir;
    }

    private async checkNewUser() {
        const hasConfigDir = fs.existsSync(this.configDir);
        config.set('isNewUser', !hasConfigDir);
    }

    private async initEnv() {
        await fs.ensureDir(this.envDir);
        await fs.ensureDir(`${this.envDir}/printing`);
        await fs.ensureDir(`${this.envDir}/laser`);
        await fs.ensureDir(`${this.envDir}/cnc`);

        const srcDir = this.envDir;
        if (fs.existsSync(srcDir)) {
            const files = fs.readdirSync(srcDir);
            for (const file of files) {
                const src = path.join(srcDir, file);
                if (fs.statSync(src).isDirectory() && file === '3dp') {
                    const newSrc = path.join(srcDir, '3dp');
                    const envFiles = fs.readdirSync(newSrc);
                    for (const envFile of envFiles) {
                        const envSrc = path.join(newSrc, envFile);
                        const envDst = path.join(path.join(srcDir, 'printing'), envFile);
                        fs.copyFileSync(envSrc, envDst);
                    }
                    rmDir(newSrc);
                }
            }
        }
    }

    private async initParameters() {
        try {
            await fs.ensureDir(this.configDir);
            await fs.ensureDir(this.defaultConfigDir);
            await fs.ensureDir(`${this.configDir}/${CNC_CONFIG_SUBCATEGORY}`);
            await fs.ensureDir(`${this.configDir}/${LASER_CONFIG_SUBCATEGORY}`);
            await fs.ensureDir(`${this.configDir}/${PRINTING_CONFIG_SUBCATEGORY}`);
        } catch (e) {
            log.error(e);
            return;
        }

        // TODO: Use print-settings directly from package
        // const CURA_ENGINE_CONFIG_LOCAL = path.resolve('../../packages/luban-print-settings/resources');
        const CURA_ENGINE_CONFIG_LOCAL = path.resolve('../../resources/print-settings');

        // default config
        await copyDir(CURA_ENGINE_CONFIG_LOCAL, this.defaultConfigDir);

        // config
        await copyDir(CURA_ENGINE_CONFIG_LOCAL, this.configDir);
    }

    private async initRecoverActive() {
        await fs.ensureDir(this.configDir);
        await fs.ensureDir(this.activeConfigDir);
        await copyDir(this.configDir, this.activeConfigDir);
    }

    private async createLongTermRecover(backupVersion, pkgVersion, isReset) {
        this.longTermConfigDir = `${this.recoverDir}/Config-${pkgVersion}`;
        if (isUndefined(backupVersion) || gt(pkgVersion, backupVersion) || isReset) {
            await fs.ensureDir(this.longTermConfigDir);

            // Copy from current config to versioned backup
            const srcDir = isReset ? this.activeConfigDir : this.configDir;
            await fs.ensureDir(srcDir);

            await copyDir(srcDir, this.longTermConfigDir);
        } else {
            return;
        }
        config.set('backupVersion', pkgVersion);
    }

    private async initLongTermRecover(isReset) {
        const pkgVersion = pkg.version;
        const backupVersion = config.get('backupVersion');
        if (isUndefined(backupVersion) || gt(pkgVersion, backupVersion) || isReset) {
            this.createLongTermRecover(backupVersion, pkgVersion, isReset);
        }
    }

    private async initFonts() {
        await fs.ensureDir(this.fontDir);

        const FONTS_LOCAL = path.resolve('../../resources/fonts');
        if (fs.existsSync(FONTS_LOCAL)) {
            const files = fs.readdirSync(FONTS_LOCAL);
            for (const file of files) {
                const src = path.join(FONTS_LOCAL, file);
                const dst = path.join(this.fontDir, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst);
                }
            }
        }

        const defaultFont = `${this.fontDir}/${DEFAULT_FONT_NAME}`;
        if (!fs.existsSync(defaultFont)) {
            downloadManager.downlaod(
                'https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com/download/fonts/NotoSansSC-Regular.otf',
                join(this.fontDir, DEFAULT_FONT_NAME)
            );
        }

        await initFonts(this.fontDir);
    }

    private async initScenes() {
        await fs.ensureDir(this.scenesDir);

        const SCENES_LOCAL = path.resolve('../../resources/scenes/');
        const resultPath = path.resolve(__dirname, this.scenesDir);

        if (fs.existsSync(SCENES_LOCAL)) {
            const files = fs.readdirSync(SCENES_LOCAL);
            for (const file of files) {
                const src = path.join(SCENES_LOCAL, file);
                const dst = path.join(resultPath, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst);
                }
            }
        }
    }

    private async initUserCase() {
        await fs.ensureDir(this.userCaseDir);
        const USER_CASE_LOCAL = path.resolve('../../resources/luban-case-library/');
        if (fs.existsSync(USER_CASE_LOCAL)) {
            const files = fs.readdirSync(USER_CASE_LOCAL);
            for (const file of files) {
                const src = path.join(USER_CASE_LOCAL, file);
                const dst = path.join(this.userCaseDir, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst);
                } else {
                    const srcPath = `${USER_CASE_LOCAL}/${file}`;
                    const dstPath = `${this.userCaseDir}/${file}`;
                    await copyDir(srcPath, dstPath);
                }
            }
        }
    }

    private async initParameterDocumentDir() {
        log.info(`Initializing parameter document dir: ${this.parameterDocumentDir}`);
        await fs.ensureDir(this.parameterDocumentDir);

        const appParameterDocumentDir = path.resolve('../../resources/print-settings-docs');

        if (fs.existsSync(appParameterDocumentDir)) {
            const files = fs.readdirSync(appParameterDocumentDir);

            for (const file of files) {
                if (file === '.git') {
                    continue;
                }

                const src = path.join(appParameterDocumentDir, file);
                const dst = path.join(this.parameterDocumentDir, file);

                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst);
                } else {
                    const srcPath = `${appParameterDocumentDir}/${file}`;
                    const dstPath = `${this.parameterDocumentDir}/${file}`;
                    await copyDir(srcPath, dstPath);
                }
            }
        }
    }

    private async initProfileDocs() {
        // Used in version <= 4.5.0, remove it if we found it
        const profileDocsDir = `${this.userDataDir}/ProfileDocs`;
        if (await fs.pathExists(profileDocsDir)) {
            await fs.remove(profileDocsDir);
        }
    }

    private async initLaserResources() {
        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapx_350.txt',
            join(this.configDir, 'mapx_350.txt')
        );

        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapx_350.txt',
            join(this.configDir, 'mapx_A350.txt')
        );

        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapy_350.txt',
            join(this.configDir, 'mapy_350.txt')
        );

        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapy_350.txt',
            join(this.configDir, 'mapy_A350.txt')
        );
    }

    public async clearSession() {
        await emptyDir(this.tmpDir);
        await emptyDir(this.sessionDir);
    }

    public async clearAll() {
        await emptyDir(this.sessionDir);
        await emptyDir(this.tmpDir);

        await emptyDir(this.defaultConfigDir);
        await emptyDir(this.configDir);
        await emptyDir(this.envDir);

        await emptyDir(this.fontDir);
        await emptyDir(this.userCaseDir);

        if (!fs.existsSync(settings.rcfile)) {
            log.error(`The path:[${settings.rcfile}] not exists.`);
            return;
        }
        fs.unlinkSync(settings.rcfile);
        log.info(`rm file:[${settings.rcfile}]`);
    }

    private upgradeConfigFile(srcDir: string): void {
        log.info(`upgrade config files in folder ${srcDir}`);

        // v4.0.0 to v4.1.0, 2021.05.11
        // Upgrade to make all configs move to new config directory

        // v4.6.2, 2023.02.21
        // Remove migrations of old files, cause old files may not usable in new software version

        // TODO: Remove old config files in v4.0.0 and v3.x.y
        // 6 folders: A150, A250, A350, Original, CncConfig, Custom
        // 9 def.json files

        // TODO: format all config files
    }
}

export default new DataStorage();
