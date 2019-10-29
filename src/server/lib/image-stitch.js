import Jimp from 'jimp';
import PerspT from 'perspective-transform';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from './random-utils';

// TODO: first step in here,we get the points
async function readImage(filePath) {
    const image = await Jimp.read(filePath);
    // image.rotate(-90).background(0x808080ff);
    image.rotate(90).background(0x808080ff);
    return image;
}

async function stitch(options) {
    const { fileNames, getPoints, corners, size = { x: 230, y: 250, z: 235 } } = options;
    const density = 3;
    const d = 100;
    const width = 1024;
    const height = 1280;

    // phrase 1 - perspective transform matrix
    const points = [];
    for (let i = 0; i < getPoints.length; i++) {
        points.push([getPoints[i].x, getPoints[i].y]);
    }

    const srcPoints = [];
    for (const p of points) {
        srcPoints.push(p[0]);
        srcPoints.push(p[1]);
    }

    const dstPoints = [];
    for (const p of corners) {
        dstPoints.push(p.x * density);
        dstPoints.push(p.y * density);
    }
    const perspT = PerspT(srcPoints, dstPoints);
    // phrase 2 - stitch
    const images = [];
    for (let j = 0; j < 9; j++) {
        const fileName = fileNames[j];
        const image = await readImage(`${DataStorage.tmpDir}/${fileName}`);
        images.push(image);
    }
    const stitched = new Jimp(size.x * density, size.y * density);
    for (let y = 0; y < size.y * density; y++) {
        for (let x = 0; x < size.x * density; x++) {
            let dy = -1;
            if (y >= (size.y / 2 - d / 2) * density) {
                dy = 0;
            }
            if (y >= (size.y / 2 + d / 2) * density) {
                dy = 1;
            }

            let dx = -1;
            if (x >= (size.x / 2 - d / 2) * density) {
                dx = 0;
            }
            if (x >= (size.x / 2 + d / 2) * density) {
                dx = 1;
            }
            const index = (y * size.x * density + x) << 2;
            const source = perspT.transformInverse(x - dx * d * density, y - dy * d * density);
            const x0 = Math.round(source[0]);
            const y0 = Math.round(source[1]);
            if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
                continue;
            }

            const from = 4 + (-dy) * 3 + dx;
            const index0 = (y0 * width + x0) << 2;
            stitched.bitmap.data[index] = images[from].bitmap.data[index0];
            stitched.bitmap.data[index + 1] = images[from].bitmap.data[index0 + 1];
            stitched.bitmap.data[index + 2] = images[from].bitmap.data[index0 + 2];
            stitched.bitmap.data[index + 3] = images[from].bitmap.data[index0 + 3];
        }
    }
    stitched.flip(false, true);

    let filename = 'stitched.jpg';
    filename = pathWithRandomSuffix(filename);
    return new Promise(async (resolve) => {
        await stitched.write(`${DataStorage.tmpDir}/${filename}`, () => {
            resolve({
                filename
            });
        });
    });
}

export default stitch;
