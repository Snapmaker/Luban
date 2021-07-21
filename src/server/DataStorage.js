import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { app } from 'electron';
import isElectron from 'is-electron';
// import semver from 'semver';
import { CNC_CONFIG_SUBCATEGORY } from './constants';
import logger from './lib/logger';
import { initFonts } from '../shared/lib/FontManager';
// import settings from './config/settings';


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

     fontDir;

     userCaseDir;

     envDir;

     constructor() {
         if (isElectron()) {
             this.userDataDir = app.getPath('userData');
         } else {
             this.userDataDir = '.';
         }
         mkdirp.sync(this.userDataDir);

         this.sessionDir = `${this.userDataDir}/Sessions`;
         this.userCaseDir = `${this.userDataDir}/UserCase`;
         this.tmpDir = `${this.userDataDir}/Tmp`;
         this.configDir = `${this.userDataDir}/Config`;
         this.fontDir = `${this.userDataDir}/Fonts`;
         this.envDir = `${this.userDataDir}/env`;
     }

     resolveRelativePath(pathString) {
         const regex = new RegExp(/^\.\//);
         if (isElectron() && regex.test(pathString)) {
             pathString = path.resolve(app.getPath('userData'), pathString);
         }
         return pathString;
     }

     async init() {
         mkdirp.sync(this.envDir);
         mkdirp.sync(`${this.envDir}/3dp`);
         mkdirp.sync(`${this.envDir}/laser`);
         mkdirp.sync(`${this.envDir}/cnc`);

         mkdirp.sync(this.tmpDir);
         mkdirp.sync(this.sessionDir);
         rmDir(this.tmpDir, false);
         rmDir(this.sessionDir, false);

         await this.initSlicer();

         await this.initFonts();
         await this.initUserCase();
         //  await this.versionAdaptation();
     }

     async initSlicer() {
         mkdirp.sync(this.configDir);
         mkdirp.sync(`${this.configDir}/${CNC_CONFIG_SUBCATEGORY}`);

         const CURA_ENGINE_CONFIG_LOCAL = '../resources/CuraEngine/Config';
         if (fs.existsSync(CURA_ENGINE_CONFIG_LOCAL)) {
             const files = fs.readdirSync(CURA_ENGINE_CONFIG_LOCAL);
             for (const file of files) {
                 const src = path.join(CURA_ENGINE_CONFIG_LOCAL, file);
                 const dst = path.join(this.configDir, file);
                 if (fs.statSync(src).isFile()) {
                     if (fs.existsSync(dst)) {
                         continue;
                     }
                     fs.copyFileSync(src, dst, () => {
                     });
                 } else {
                     const srcPath = `${CURA_ENGINE_CONFIG_LOCAL}/${file}`;
                     const dstPath = `${this.configDir}/${file}`;
                     await this.copyDirForInitSlicer(srcPath, dstPath);
                 }
             }
         }
     }

     async copyDirForInitSlicer(src, dst) {
         mkdirp.sync(dst);

         if (fs.existsSync(src)) {
             const files = fs.readdirSync(src);
             for (const file of files) {
                 const srcPath = path.join(src, file);
                 const dstPath = path.join(dst, file);
                 if (fs.statSync(srcPath).isFile()) {
                     if (fs.existsSync(dstPath)) {
                         return;
                     }
                     fs.copyFileSync(srcPath, dstPath);
                 } else {
                     // Todo: cause dead cycle?
                     await this.copyDirForInitSlicer(srcPath, dstPath);
                 }
             }
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
}

export default new DataStorage();
