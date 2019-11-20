import Jimp from 'jimp';
import PerspT from 'perspective-transform';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from './random-utils';

// TODO: first step in here,we get the points
async function readImage(filePath) {
    const image = await Jimp.read(filePath);
    // image.rotate(-90).background(0x808080ff);
    return image;
}

export const stitchEach = async (options) => {
    const { stitchFileName, getPoints, corners, size, currentIndex } = options;
    const density = 3;
    const d = 100;
    // const width = 1024;
    // const height = 1280;

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
    // const images = [];
    const image = await readImage(`${DataStorage.tmpDir}/${stitchFileName}`);
    // add to show stitch pic
    const { width, height } = image.bitmap;
    let xSize = 0, ySize = 0;
    let startxSize = 0;
    let startySize = 0;
    let endxSize = size.x;
    let endySize = size.y;

    if (parseInt(currentIndex / 3, 10) === 1) {
        ySize = d;
    } else {
        ySize = (size.y - d) / 2;
    }
    if (currentIndex % 3 === 1) {
        xSize = d;
    } else {
        xSize = (size.x - d) / 2;
    }

    if (parseInt((currentIndex) / 3, 10) === 0) {
        startySize = size.y - ySize;
    } else if (parseInt((currentIndex) / 3, 10) === 1) {
        startySize = (size.y - ySize) / 2;
        endySize = (size.y + ySize) / 2;
    } else if (parseInt((currentIndex) / 3, 10) === 2) {
        endySize = ySize;
    }
    if (currentIndex % 3 === 0) {
        endxSize = size.x - xSize;
    } else if (currentIndex % 3 === 1) {
        startxSize = (size.x - xSize) / 2;
        endxSize = (size.x + xSize) / 2;
    } else if (currentIndex % 3 === 2) {
        startxSize = size.x - xSize;
    }
    // console.log('this is size', startxSize, endxSize, startySize, endySize);

    console.log('this is:', currentIndex, startxSize, endxSize, startySize, endySize);
    const stitched = new Jimp(xSize * density, ySize * density);

    for (let y = startySize * density; y < endySize * density; y++) {
        for (let x = startxSize * density; x < endxSize * density; x++) {
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
            const index = ((y - startySize * density) * xSize * density + x - startxSize * density) << 2;
            // const index = ((y)* xSize * density + x ) << 2;

            const source = perspT.transformInverse((x - dx * d * density), (y - dy * d * density));
            // const source = perspT.transformInverse((x), (y));
            const x0 = Math.round(source[0]);
            const y0 = Math.round(source[1]);
            if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
                continue;
            }
            const index0 = ((y0) * width + x0) << 2;
            stitched.bitmap.data[index] = image.bitmap.data[index0];
            stitched.bitmap.data[index + 1] = image.bitmap.data[index0 + 1];
            stitched.bitmap.data[index + 2] = image.bitmap.data[index0 + 2];
            stitched.bitmap.data[index + 3] = image.bitmap.data[index0 + 3];
        }
    }
    stitched.flip(false, true);

    let filename = `stitchedEach${currentIndex}.jpg`;
    filename = pathWithRandomSuffix(filename);
    return new Promise(async (resolve) => {
        await stitched.write(`${DataStorage.tmpDir}/${filename}`, () => {
            console.log('resolve success>>>>>>', filename, xSize, ySize);
            resolve({
                filename,
                xSize,
                ySize
            });
        });
    });
};


export const stitch = async (options) => {
    const { fileNames, getPoints, corners, size } = options;
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
};
