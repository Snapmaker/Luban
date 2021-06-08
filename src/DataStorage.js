import fs from 'fs';
import mkdirp from 'mkdirp';
import { app } from 'electron';

const rmDir = (dirPath, removeSelf) => {
    console.info(`Clearing folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        console.info(`Removing files: ${files}`);
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


// platform related
class DataStorage {
    static userDataDir;

    static tmpDir;

    static sessionDir;

    static init() {
        // Create the user data directory if it does not exist
        this.userDataDir = app.getPath('userData');
        mkdirp.sync(this.userDataDir);

        this.tmpDir = `${this.userDataDir}/Tmp`;
        this.sessionDir = `${this.userDataDir}/Sessions`;

        mkdirp.sync(this.tmpDir);
        mkdirp.sync(this.sessionDir);

        this.clear();
    }

    static clear() {
        try {
            rmDir(this.tmpDir, false);
            rmDir(this.sessionDir, false);
        } catch (e) {
            console.error(e);
        }
    }
}

export default DataStorage;
