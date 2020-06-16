import fs from 'fs';
import getOffsetCreator from '../lib/abl';
import { promiseInterpret } from '../lib/interpret';
import DataStorage from '../DataStorage';

const readline = require('readline');

DataStorage.init(false);

export default class LevelingGcode {
    async startTask({ data, onProgress, onComplete }) {
        onProgress({ tips: 'leveling gcode startTask' });
        const { rect, zValues, gridNum, uploadName } = data;
        const targetName = `${uploadName.split('.')[0]}-leveled.${uploadName.split('.')[1]}`;
        const targetFile = `${DataStorage.tmpDir}/${targetName}`;
        const sourceFile = `${DataStorage.tmpDir}/${uploadName}`;
        const source = readline.createInterface({
            input: fs.createReadStream(sourceFile, { encoding: 'utf8' })
        });
        const { size: sourceSize } = fs.statSync(sourceFile);

        const target = fs.createWriteStream(targetFile, { encoding: 'utf8' });
        const getOffset = getOffsetCreator(zValues, gridNum, rect);
        let lastX = 0, lastY = 0, lastZ = 0;
        let readSize = 0;
        let lastProgress = 0;

        source.on('line', async (gcodeStr) => {
            readSize += gcodeStr.length;
            const progress = Math.floor(readSize / sourceSize * 100);
            if (progress > lastProgress + 4) {
                onProgress({ progress, tips: '处理文件中' });
                lastProgress = progress;
            }

            let convertedStr = '';

            if (gcodeStr[0] === 'G' || gcodeStr[0] === 'M') {
                const gcodeObj = await promiseInterpret(gcodeStr);
                const x = gcodeObj.X || lastX;
                const y = gcodeObj.Y || lastY;
                const z = gcodeObj.Z;
                if (z === undefined) {
                    convertedStr = `${gcodeStr} Z${(lastZ + getOffset([x, y, z])).toFixed(3)} `;
                } else {
                    if (z % 1 === 0) {
                        gcodeStr = gcodeStr.replace(`Z${z}.000`, `Z${z}`);
                    }
                    convertedStr = gcodeStr.replace(`Z${z}`, `Z${(z + getOffset([x, y, z])).toFixed(3)}`);
                    lastZ = z;
                }
                lastX = x;
                lastY = y;
            } else {
                convertedStr = gcodeStr;
            }


            target.write(`${convertedStr}\n`);
        });
        source.on('close', () => {
            const { size, mtimeMs } = fs.statSync(targetFile);

            onComplete({ name: targetName, uploadName: targetName, size, lastModifiedDate: mtimeMs, thumbnail: '' });
        });
    }
}
