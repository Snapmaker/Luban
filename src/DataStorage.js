import * as fs from 'fs-extra';
import electron from 'electron';

const emptyDir = async (dirPath) => {
    // eslint-disable-next-line no-console
    console.info(`Clearing folder ${dirPath}`);

    try {
        await fs.emptyDir(dirPath);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
    }
};


// platform related
class DataStorage {
    static userDataDir;

    static tmpDir;

    static sessionDir;

    static init() {
        // Create the user data directory if it does not exist
        this.userDataDir = electron.app.getPath('userData');
        fs.ensureDir(this.userDataDir);

        this.tmpDir = `${this.userDataDir}/Tmp`;
        this.sessionDir = `${this.userDataDir}/Sessions`;

        fs.ensureDir(this.tmpDir);
        fs.ensureDir(this.sessionDir);

        this.clear();
    }

    static clear() {
        try {
            emptyDir(this.tmpDir, false);
            emptyDir(this.sessionDir, false);
        } catch (e) {
            console.error(e);
        }
    }
}

export default DataStorage;
