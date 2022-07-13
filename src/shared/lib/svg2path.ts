import fs from 'fs';

class SVG2Path {
    public async parseFile(filePath: string) {
        const svgStr = await this.readFile(filePath);
        console.log(svgStr);
    }

    private async readFile(filePath: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', async (err, str) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    resolve(str);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}

export default SVG2Path;
