import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';

function generate(param, cb) {
    const { dwellTime, quality, imageSrc, sizeWidth, sizeHeight } = param;
    const imageWidth = sizeWidth * quality;
    const imageHeight = sizeHeight * quality;
    
    let filename = path.basename(imageSrc);
    let content = '';
    content += 'G90\n';
    content += 'G21\n';
    content += 'F288\n';

    Jimp.read(`../web/images/${filename}`, (err, doggy) => {
        doggy.resize(parseFloat(imageWidth), parseFloat(imageHeight))
            .flip(false, true)
            .scan(0, 0, doggy.bitmap.width, doggy.bitmap.height, (x, y, idx) => {
                if (doggy.bitmap.data[idx] < 128) {
                    content += `G0 X${x / quality} Y${y / quality}\n`;
                    content += 'M03\n';
                    content += `G4 P${dwellTime}\n`;
                    content += 'M05\n';
                }
            }, () => {
                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    cb(`${filename}.gcode`);
                });
            });
    });
}

export default generate;
