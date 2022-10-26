import path, { join } from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { includes, isUndefined, gt, isNil } from 'lodash';
import { v4 as uuid } from 'uuid';
import isElectron from 'is-electron';
import semver from 'semver';
import { CNC_CONFIG_SUBCATEGORY, LASER_CONFIG_SUBCATEGORY, PRINTING_CONFIG_SUBCATEGORY, MATERIAL_TYPE_ARRAY } from './constants';
import { cncUniformProfile } from './lib/profile/cnc-uniform-profile';
import logger from './lib/logger';
import { initFonts } from '../shared/lib/FontManager';
import settings from './config/settings';
import config from './services/configstore';
import pkg from '../../package.json';
import downloadManager from './lib/downloadManager';

const log = logger('server:DataStorage');
export const rmDir = (dirPath, removeSelf) => {
    log.info(`Clearing folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        log.info(`Removing files: ${files}`);
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


class DataStorage {
    userDataDir;

    sessionDir;

    tmpDir;

    configDir;

    defaultConfigDir;

    fontDir;

    scenesDir;

    userCaseDir;

    profileDocsDir;

    envDir;

    constructor() {
        if (isElectron()) {
            this.userDataDir = global.luban.userDataDir;
        } else {
            this.userDataDir = '.';
        }
        mkdirp.sync(this.userDataDir);

        this.sessionDir = `${this.userDataDir}/Sessions`;
        this.userCaseDir = `${this.userDataDir}/UserCase`;
        this.profileDocsDir = `${this.userDataDir}/ProfileDocs`;
        this.tmpDir = `${this.userDataDir}/Tmp`;
        this.configDir = `${this.userDataDir}/Config`;
        this.defaultConfigDir = `${this.userDataDir}/Default`;
        this.fontDir = `${this.userDataDir}/Fonts`;
        this.envDir = `${this.userDataDir}/env`;
        this.scenesDir = `${this.userDataDir}/Scenes`;
        this.recoverDir = `${this.userDataDir}/snapmaker-recover`;
        this.activeConfigDir = `${this.recoverDir}/Config-active`;
        this.longTermConfigDir = '';
    }

    resolveRelativePath(pathString) {
        const regex = new RegExp(/^\.\//);
        if (isElectron() && regex.test(pathString)) {
            pathString = path.resolve(this.userDataDir, pathString);
        }
        return pathString;
    }

    async init(isReset = false) {
        const definitionUpdated = config.get('DefinitionUpdated');
        const gaUserId = config.get('gaUserId');
        if (isNil(gaUserId)) {
            config.set('gaUserId', uuid());
        }
        let overwriteProfiles = false;
        if (semver.gte(settings.version, '4.1.0') && (!definitionUpdated || !definitionUpdated[settings.version])) {
            overwriteProfiles = true;
            config.set('DefinitionUpdated', {
                ...definitionUpdated,
                [settings.version]: true
            });
        }
        mkdirp.sync(this.envDir);
        mkdirp.sync(`${this.envDir}/printing`);
        mkdirp.sync(`${this.envDir}/laser`);
        mkdirp.sync(`${this.envDir}/cnc`);

        mkdirp.sync(this.tmpDir);
        mkdirp.sync(this.sessionDir);
        mkdirp.sync(this.userCaseDir);
        mkdirp.sync(this.scenesDir);
        !isReset && mkdirp.sync(this.recoverDir);
        rmDir(this.tmpDir, false);
        rmDir(this.sessionDir, false);

        !isReset && await this.checkNewUser();
        await this.initLongTermRecover(isReset);
        await this.initSlicer(overwriteProfiles, isReset);
        await this.initEnv();

        await this.initFonts();
        await this.initScenes();
        await this.initUserCase();
        await this.initProfileDocs();

        // if alt+shift+r, cannot init recover config
        !isReset && await this.initRecoverActive();

        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapx_350.txt',
            join(this.configDir, 'mapx_350.txt')
        );

        downloadManager.downlaod(
            'https://snapmaker-luban.s3.us-west-1.amazonaws.com/camera-capture/mapy_350.txt',
            join(this.configDir, 'mapy_350.txt')
        );
    }

    async copyDirForInitSlicer({
        srcDir, dstDir,
        overwriteTag = false, inherit = false
    }) {
        if (dstDir && srcDir) {
            mkdirp.sync(dstDir);
            if (fs.existsSync(srcDir)) {
                const files = fs.readdirSync(srcDir);
                for (const file of files) {
                    const src = path.join(srcDir, file);
                    const dst = path.join(dstDir, file);
                    if (fs.statSync(src).isFile()) {
                        if (fs.existsSync(dst) && !overwriteTag) {
                            return;
                        }
                        fs.copyFileSync(src, dst, (err) => {
                            console.error('err', err);
                        });
                    } else {
                        await this.copyDirForInitSlicer({
                            srcDir: src,
                            dstDir: dst,
                            overwriteTag: inherit ? overwriteTag : false,
                            inherit
                        });
                    }
                }
            }
        }
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

    async checkNewUser() {
        const hasConfigDir = fs.existsSync(this.configDir);
        config.set('isNewUser', !hasConfigDir);
    }

    async initEnv() {
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
                        fs.copyFileSync(envSrc, envDst, () => {
                        });
                    }
                    rmDir(newSrc);
                }
            }
        }
    }

    async initSlicer(overwriteProfiles = false, isReset = false) {
        mkdirp.sync(this.configDir);
        mkdirp.sync(this.defaultConfigDir);
        mkdirp.sync(`${this.configDir}/${CNC_CONFIG_SUBCATEGORY}`);
        mkdirp.sync(`${this.configDir}/${LASER_CONFIG_SUBCATEGORY}`);
        mkdirp.sync(`${this.configDir}/${PRINTING_CONFIG_SUBCATEGORY}`);

        const CURA_ENGINE_CONFIG_LOCAL = '../resources/CuraEngine/Config';
        await this.copyDirForInitSlicer({
            srcDir: CURA_ENGINE_CONFIG_LOCAL,
            dstDir: this.configDir,
            overwriteTag: true,
            inherit: overwriteProfiles
        });
        this.upgradeConfigFile(this.configDir);
        await this.copyDirForInitSlicer({
            srcDir: CURA_ENGINE_CONFIG_LOCAL,
            dstDir: this.defaultConfigDir,
            overwriteTag: true,
            inherit: true
        });
        const isNewUser = config.get('isNewUser');
        isNewUser && !isReset && await this.copyDirForInitSlicer({
            srcDir: this.configDir,
            dstDir: this.longTermConfigDir,
            overwriteTag: true,
            inherit: true
        });
    }

    async initRecoverActive() {
        mkdirp.sync(this.activeConfigDir);
        await this.copyDirForInitSlicer({
            srcDir: this.configDir,
            dstDir: this.activeConfigDir,
            overwriteTag: true,
            inherit: true
        });
    }

    async createLongTermRecover(backupVersion, pkgVersion, isReset) {
        this.longTermConfigDir = `${this.recoverDir}/Config-${new Date().getTime()}`;
        if (isUndefined(backupVersion) || gt(pkgVersion, backupVersion) || isReset) {
            mkdirp.sync(this.longTermConfigDir);
            const srcDir = isReset ? this.activeConfigDir : this.configDir;
            await this.copyDirForInitSlicer({
                srcDir,
                dstDir: this.longTermConfigDir,
                overwriteTag: true,
                inherit: true
            });
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

    async initScenes() {
        mkdirp.sync(this.scenesDir);

        const SCENES_LOCAL = '../resources/scenes/';
        const resultPath = path.resolve(__dirname, this.scenesDir);
        if (fs.existsSync(SCENES_LOCAL)) {
            const files = fs.readdirSync(SCENES_LOCAL);
            for (const file of files) {
                const src = path.join(SCENES_LOCAL, file);
                const dst = path.join(resultPath, file);
                if (fs.statSync(src)
                    .isFile()) {
                    fs.copyFileSync(src, dst, () => {
                    });
                }
            }
        }
    }


    async initUserCase() {
        mkdirp.sync(this.userCaseDir);
        const USER_CASE_LOCAL = '../resources/luban-case-library/';
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

    async initProfileDocs() {
        mkdirp.sync(this.profileDocsDir);
        const PROFILE_DOCS_LOCAL = '../resources/ProfileDocs/';
        if (fs.existsSync(PROFILE_DOCS_LOCAL)) {
            const files = fs.readdirSync(PROFILE_DOCS_LOCAL);
            for (const file of files) {
                if (file === '.git') continue;
                const src = path.join(PROFILE_DOCS_LOCAL, file);
                const dst = path.join(this.profileDocsDir, file);
                if (fs.statSync(src)
                    .isFile()) {
                    fs.copyFileSync(src, dst);
                } else {
                    const srcPath = `${PROFILE_DOCS_LOCAL}/${file}`;
                    const dstPath = `${this.profileDocsDir}/${file}`;
                    await this.copyDir(srcPath, dstPath);
                }
            }
        }
    }

    async copyDir(src, dst) {
        mkdirp.sync(dst);
        if (fs.existsSync(src)) {
            const files = fs.readdirSync(src);
            for (const file of files) {
                const srcPath = path.join(src, file);
                const dstPath = path.join(dst, file);
                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, dstPath);
                } else {
                    // Todo: cause dead cycle?
                    await this.copyDir(srcPath, dstPath);
                }
            }
        }
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

    clearAll() {
        rmDir(this.sessionDir, true);
        rmDir(this.userCaseDir, true);
        rmDir(this.tmpDir, true);
        rmDir(this.configDir, true);
        rmDir(this.defaultConfigDir, true);
        rmDir(this.fontDir, true);
        rmDir(this.envDir, true);
        if (!fs.existsSync(settings.rcfile)) {
            log.error(`The path:[${settings.rcfile}] not exists.`);
            return;
        }
        fs.unlinkSync(settings.rcfile);
        log.info(`rm file:[${settings.rcfile}]`);
    }
}

export default new DataStorage();
