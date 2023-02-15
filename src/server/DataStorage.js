import * as fs from 'fs-extra';
import isElectron from 'is-electron';
import { gt, includes, isNil, isUndefined } from 'lodash';
import path, { join } from 'path';
import { v4 as uuid } from 'uuid';

import pkg from '../../package.json';
import { initFonts } from '../shared/lib/FontManager';
import settings from './config/settings';
import { CNC_CONFIG_SUBCATEGORY, LASER_CONFIG_SUBCATEGORY, MATERIAL_TYPE_ARRAY, PRINTING_CONFIG_SUBCATEGORY } from './constants';
import downloadManager from './lib/downloadManager';
import logger from './lib/logger';
import { cncUniformProfile } from './lib/profile/cnc-uniform-profile';
import config from './services/configstore';

const log = logger('server:DataStorage');

export const rmDir = (dirPath, removeSelf) => {
    log.info(`Clearing folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
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
 * Copy files from srcDir to dstDir.
 *
 * @param {string} srcDir
 * @param {string} dstDir
 * @param {*} options
 * @returns Promise<boolean>
 */
async function copyDir(srcDir, dstDir, options = {}) {
    log.info(`Copying folder ${srcDir} to ${dstDir}`);

    options.overwrite = options.overwrite || true;

    try {
        await fs.copy(srcDir, dstDir, options);
    } catch (e) {
        log.error(e);
    }
}

/**
 * Ensure directory is empty.
 */
const emptyDir = async (dirPath) => {
    log.info(`Clearing folder ${dirPath}`);

    try {
        await fs.emptyDir(dirPath);
    } catch (e) {
        log.error(e);
    }
};

/**
 * Remove a directory.
 *
 * @param {string} dirPath
 */
/*
const removeDir = async (dirPath) => {
    log.info(`Removing folder ${dirPath}`);

    try {
        await fs.remove(dirPath);
    } catch (e) {
        log.error(e);
    }
};
*/

class DataStorage {
    userDataDir = null;

    sessionDir;

    tmpDir;

    configDir;

    defaultConfigDir;

    fontDir;

    scenesDir;

    userCaseDir;

    envDir;

    parameterDocumentDir = null;

    constructor() {
        if (isElectron()) {
            // TODO: Refactor this
            this.userDataDir = global.luban.userDataDir;
            // this.userDataDir = process.env.USER_DATA_DIR;
        } else {
            this.userDataDir = '.';
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

    resolveRelativePath(pathString) {
        const regex = new RegExp(/^\.\//);
        if (isElectron() && regex.test(pathString)) {
            pathString = path.resolve(this.userDataDir, pathString);
        }
        return pathString;
    }

    async init(isReset = false) {
        const gaUserId = config.get('gaUserId');
        if (isNil(gaUserId)) {
            config.set('gaUserId', uuid());
        }

        await fs.ensureDir(this.tmpDir);
        await fs.ensureDir(this.sessionDir);
        await fs.ensureDir(this.userCaseDir);
        await fs.ensureDir(this.scenesDir);
        !isReset && fs.ensureDir(this.recoverDir);

        await this.clearSession();

        // prepare directories
        !isReset && await this.checkNewUser();

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

        await this.initLongTermRecover(isReset);
        await this.initEnv();

        await this.initFonts();
        await this.initScenes();

        if (isReset || overwriteProfiles) {
            await this.initParameters(overwriteProfiles, isReset);
            await this.initParameterDocumentDir();
            await this.initProfileDocs();
            await this.initUserCase();

            await this.initLaserResources();
        }

        // upgrade and validate parameter config files
        this.upgradeConfigFile(this.configDir);

        // if alt+shift+r, cannot init recover config
        if (!isReset) {
            await this.initRecoverActive();
        }
    }

    getParameterDocumentDir() {
        return this.parameterDocumentDir;
    }

    async checkNewUser() {
        const hasConfigDir = fs.existsSync(this.configDir);
        config.set('isNewUser', !hasConfigDir);
    }

    async initEnv() {
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

    async initParameters() {
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
        await copyDir(CURA_ENGINE_CONFIG_LOCAL, this.defaultConfigDir, { overwrite: true });

        // config
        await copyDir(CURA_ENGINE_CONFIG_LOCAL, this.configDir, { overwrite: false });

        await copyDir(this.configDir, this.longTermConfigDir, { overwrite: true });
    }

    async initRecoverActive() {
        await fs.ensureDir(this.configDir);
        await fs.ensureDir(this.activeConfigDir);
        await copyDir(this.configDir, this.activeConfigDir, { overwrite: true });
    }

    async createLongTermRecover(backupVersion, pkgVersion, isReset) {
        this.longTermConfigDir = `${this.recoverDir}/Config-${pkgVersion}`;
        if (isUndefined(backupVersion) || gt(pkgVersion, backupVersion) || isReset) {
            await fs.ensureDir(this.longTermConfigDir);
            const srcDir = isReset ? this.activeConfigDir : this.configDir;
            await fs.ensureDir(srcDir);
            await copyDir(srcDir, this.longTermConfigDir, { rewrite: true });
        } else {
            return;
        }
        config.set('backupVersion', pkgVersion);
    }

    async initLongTermRecover(isReset) {
        const pkgVersion = pkg.version;
        const backupVersion = config.get('backupVersion');
        if (isUndefined(backupVersion) || gt(pkgVersion, backupVersion) || isReset) {
            this.createLongTermRecover(backupVersion, pkgVersion, isReset);
        }
    }

    async initFonts() {
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
        await initFonts(this.fontDir);
    }

    async initScenes() {
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

    async initUserCase() {
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

    async initParameterDocumentDir() {
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

    async initProfileDocs() {
        // Used in version <= 4.5.0, remove it if we found it
        const profileDocsDir = `${this.userDataDir}/ProfileDocs`;
        if (await fs.pathExists(profileDocsDir)) {
            await fs.remove(profileDocsDir);
        }
    }

    async initLaserResources() {
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

    async copyFile(src, dst, isCover = true) {
        if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
            return;
        }
        if (!isCover && fs.existsSync(dst)) {
            return;
        }
        fs.copyFileSync(src, dst);
    }

    async clearSession() {
        await emptyDir(this.tmpDir);
        await emptyDir(this.sessionDir);
    }

    async clearAll() {
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

    // v4.0.0 to v4.1.0 : upgrade to make all configs move to new config directory
    upgradeConfigFile(srcDir) {
        const printingConfigNames = [];
        const cncConfigPaths = [];
        const officialMachine = ['A150', 'A250', 'A350', 'Original'];
        if (fs.existsSync(srcDir)) {
            const files = fs.readdirSync(srcDir);
            const materialRegex = /^material\.([0-9]{8})\.def\.json$/;
            const qualityRegex = /^quality\.([0-9]{8})\.def\.json$/;
            for (const file of files) {
                const src = path.join(srcDir, file);
                if (fs.statSync(src).isFile()) {
                    if (materialRegex.test(file) || qualityRegex.test(file) || includes([
                        'material.abs.def.json',
                        'material.pla.def.json',
                        'material.petg.def.json'], file)) {
                        const data = fs.readFileSync(src, 'utf8');
                        const json = JSON.parse(data);
                        if (file === 'material.abs.def.json') {
                            json.isRecommended = true;
                            json.category = 'ABS';
                            json.i18nName = 'key-default_name-ABS_White';
                            json.overrides.material_type = {
                                default_value: 'abs'
                            };
                        } else if (file === 'material.pla.def.json') {
                            json.isRecommended = true;
                            json.i18nName = 'key-default_name-PLA_White';
                            json.category = 'PLA';
                            json.overrides.material_type = {
                                default_value: 'pla'
                            };
                        } else if (file === 'material.petg.def.json') {
                            json.isRecommended = true;
                            json.i18nName = 'key-default_name-PETG_White';
                            json.category = 'PETG';
                            json.overrides.material_type = {
                                default_value: 'petg'
                            };
                        }
                        fs.writeFileSync(src, JSON.stringify(json));
                        printingConfigNames.push(file);
                    }
                } else {
                    if (file === 'CncConfig') {
                        let cncConfigFiles = fs.readdirSync(src);
                        for (const cncFile of cncConfigFiles) {
                            cncUniformProfile(cncFile, src);
                        }
                        cncConfigFiles = fs.readdirSync(src);
                        for (const cncFile of cncConfigFiles) {
                            if (!includes([
                                'DefaultCVbit.def.json',
                                'DefaultMBEM.def.json',
                                'DefaultFEM.def.json',
                                'DefaultSGVbit.def.json',
                                'active.def.json',
                                'Default.def.json',
                                'active.defv2.json'], cncFile)) {
                                const cncConfigPath = path.join(src, cncFile);
                                cncConfigPaths.push(cncConfigPath);
                            }
                        }
                    } else if (file !== 'cnc' && file !== 'laser' && file !== 'printing') {
                        rmDir(src);
                    }
                }
            }
        }
        if (printingConfigNames.length) {
            const printingDir = `${srcDir}/${PRINTING_CONFIG_SUBCATEGORY}`;
            const seriesFiles = fs.readdirSync(printingDir);
            for (const oldFileName of printingConfigNames) {
                const oldFilePath = `${srcDir}/${oldFileName}`;
                for (const file of seriesFiles) {
                    let currentFile = file;
                    if (includes(officialMachine, file)) {
                        currentFile = `${file.toLocaleLowerCase()}_single`;
                    }
                    const src = path.join(printingDir, currentFile);
                    if (!fs.statSync(src).isFile()) {
                        const newFilePath = `${src}/${oldFileName}`;
                        fs.copyFileSync(oldFilePath, newFilePath);
                    }
                }
                fs.unlinkSync(oldFilePath);
            }
        }
        if (cncConfigPaths.length) {
            const cncDir = `${srcDir}/${CNC_CONFIG_SUBCATEGORY}`;
            const seriesFiles = fs.readdirSync(cncDir);
            for (const oldFilePath of cncConfigPaths) {
                for (const file of seriesFiles) {
                    let currentFile = file;
                    if (includes(officialMachine, file)) {
                        currentFile = `${file.toLocaleLowerCase()}_standard`;
                    }
                    const src = path.join(cncDir, currentFile);
                    if (!fs.statSync(src).isFile()) {
                        // fix profile name changing in v4.1.0
                        let newFileName = path.basename(oldFilePath);
                        if (newFileName === 'DefaultFEM.defv2.json') {
                            newFileName = 'tool.default_FEM1.5.def.json';
                        } else if (/^Default/.test(newFileName)) {
                            newFileName = `tool.default_${newFileName.slice(7)}`;
                        } else if (newFileName === 'REpoxySGVbit.defv2.json') {
                            newFileName = 'tool.rEpoxy_SGVbit.def2.json';
                        } else if (newFileName === 'RAcrylicFEM.defv2.json') {
                            newFileName = 'tool.rAcrylic_FEM.def2.json';
                        } else {
                            newFileName = `tool.${newFileName}`;
                        }
                        if (/([A-Za-z0-9_]+)\.defv2\.json$/.test(newFileName)) {
                            newFileName = newFileName.replace(/\.defv2\.json$/, '.def.json');
                        }
                        const newFilePath = `${src}/${newFileName}`;
                        fs.copyFileSync(oldFilePath, newFilePath);
                    }
                }
            }
        }
        if (fs.existsSync(srcDir)) {
            const files = fs.readdirSync(srcDir);
            for (const file of files) {
                const src = path.join(srcDir, file);
                if (file === 'printing') {
                    const printingSeries = fs.readdirSync(src);
                    for (const series of printingSeries) {
                        const actualSeriesPath = path.join(src, series);
                        if (fs.statSync(actualSeriesPath).isDirectory()) {
                            const profilePaths = fs.readdirSync(actualSeriesPath);
                            for (const profilePath of profilePaths) {
                                const materialRegex = /^material.*\.def\.json$/;
                                if (materialRegex.test(profilePath)) {
                                    const distProfilePath = path.join(actualSeriesPath, profilePath);
                                    const data = fs.readFileSync(distProfilePath, 'utf8');
                                    const json = JSON.parse(data);
                                    let category = json.category;
                                    if (!(MATERIAL_TYPE_ARRAY.includes(category))) {
                                        category = MATERIAL_TYPE_ARRAY[MATERIAL_TYPE_ARRAY.length - 1];
                                    }
                                    if (json.overrides && !(json.overrides.material_type)) {
                                        json.category = category;
                                        json.overrides.material_type = {
                                            default_value: category.toLowerCase()
                                        };
                                        fs.writeFileSync(distProfilePath, JSON.stringify(json));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (fs.existsSync(`${srcDir}/CncConfig`)) {
            rmDir(`${srcDir}/CncConfig`);
        }
    }
}

export default new DataStorage();
