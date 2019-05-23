import fs from 'fs';
import mkdirp from 'mkdirp';
import { app } from 'electron';

const rmDir = (dirPath, removeSelf) => {
    console.log(`del folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        console.log(files);
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


// platform related
class DataStorage {
    static userDataDir;

    static cacheDir;

    static sessionDir;

    static init() {
        // Create the user data directory if it does not exist
        this.userDataDir = app.getPath('userData');
        mkdirp.sync(this.userDataDir);

        this.cacheDir = `${this.userDataDir}/Cache`;
        mkdirp.sync(this.cacheDir);

        this.sessionDir = `${this.userDataDir}/Sessions`;
        mkdirp.sync(this.sessionDir);

        this.clear();
    }

    static clear() {
        rmDir(this.cacheDir, false);
        rmDir(this.sessionDir, false);
    }
}

export default DataStorage;
