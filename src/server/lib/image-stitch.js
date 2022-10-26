import Jimp from 'jimp';
import PerspT from 'perspective-transform';
import DataStorage from '../DataStorage';
import workerManager from '../services/task-manager/workerManager';
import { pathWithRandomSuffix } from './random-utils';

// TODO: first step in here,we get the points
async function readImage(filePath) {
    const image = await Jimp.read(filePath);
    return image;
}

export const remapImage = (fileName, materialThickness, series) => {
    return new Promise((resolve) => {
        workerManager.imageRemap(
            [fileName, series, materialThickness, DataStorage.tmpDir, DataStorage.configDir],
            (res) => {
                if (res.status === 'complete') {
                    resolve(res.output);
                } else {
                    resolve(res.input);
                }
            }
        );
    });
};

export const stitchEach = async (options) => {
    const { getPoints, corners, size, currentIndex, centerDis, picAmount, materialThickness, applyAntiDistortion, isCalibration, series } = options;
    let { stitchFileName } = options;
    if (!stitchFileName) {
        return Promise.resolve();
    }
    if (applyAntiDistortion) {
        stitchFileName = await remapImage(stitchFileName, materialThickness, series);
    }

    const density = 3;
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
        ySize = centerDis;
    } else {
        ySize = (size.y - centerDis) / 2;
    }
    if (currentIndex % 3 === 1) {
        xSize = centerDis;
    } else {
        xSize = (size.x - centerDis) / 2;
    }
    let stitched;

    if (picAmount === 1) {
        stitched = new Jimp(size.x * density, size.y * density);
        for (let y = 0; y < size.y * density; y++) {
            for (let x = 0; x < size.x * density; x++) {
                // const index = ((y)* xSize * density + x ) << 2;

                const source = perspT.transformInverse(x, y);
                const x0 = Math.round(source[0]);
                const y0 = Math.round(source[1]);
                // if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
                //     continue;
                // }

                const index = ((y * size.x * density + x) << 2);
                const index0 = ((y0 * width + x0) << 2);
                stitched.bitmap.data[index] = image.bitmap.data[index0];
                stitched.bitmap.data[index + 1] = image.bitmap.data[index0 + 1];
                stitched.bitmap.data[index + 2] = image.bitmap.data[index0 + 2];
                stitched.bitmap.data[index + 3] = image.bitmap.data[index0 + 3];
            }
        }
    }

    if (picAmount === 9) {
        if (parseInt((currentIndex) / 3, 10) === 0) {
            startySize = size.y - ySize;
        } else if (parseInt((currentIndex) / 3, 10) === 1) {
            startySize = (size.y - ySize) / 2;
            endySize = (size.y + ySize) / 2;
        } else if (parseInt((currentIndex) / 3, 10) === 2) {
            endySize = ySize;
        }
        if (currentIndex % 3 === 0) {
            // 左侧
            endxSize = xSize;
        } else if (currentIndex % 3 === 1) {
            // 中间
            startxSize = Math.floor((size.x - xSize) / 2);
            endxSize = Math.floor((size.x + xSize) / 2);
        } else if (currentIndex % 3 === 2) {
            // 右侧
            startxSize = size.x - xSize;
        }

        const outputWidth = isCalibration ? size.x : xSize;
        const outputHeight = isCalibration ? size.y : ySize;
        stitched = new Jimp(outputWidth * density, outputHeight * density);
        for (let y = startySize * density; y < endySize * density; y++) {
            for (let x = startxSize * density; x < endxSize * density; x++) {
                let dy = -1;
                if (y >= (size.y / 2 - centerDis / 2) * density) {
                    dy = 0;
                }
                if (y >= (size.y / 2 + centerDis / 2) * density) {
                    dy = 1;
                }

                let dx = -1;
                if (x >= (size.x / 2 - centerDis / 2) * density) {
                    dx = 0;
                }
                if (x >= (size.x / 2 + centerDis / 2) * density) {
                    dx = 1;
                }

                const source = perspT.transformInverse((x - dx * centerDis * density), (y - dy * centerDis * density));
                const x0 = Math.round(source[0]);
                const y0 = Math.round(source[1]);
                if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
                    continue;
                }

                const index0 = ((y0) * width + x0) << 2;

                const index = (() => {
                    if (isCalibration) {
                        // return ((y - startySize * density) * outputWidth * density + x - startxSize * density) << 2;
                        return (y * outputWidth * density + x) << 2;
                        // return (y * outputWidth * density + x * density) << 2;
                    }
                    return ((y - startySize * density) * xSize * density + x - startxSize * density) << 2;
                })();
                // const index = ((y)* xSize * density + x ) << 2;
                stitched.bitmap.data[index] = image.bitmap.data[index0];
                stitched.bitmap.data[index + 1] = image.bitmap.data[index0 + 1];
                stitched.bitmap.data[index + 2] = image.bitmap.data[index0 + 2];
                stitched.bitmap.data[index + 3] = image.bitmap.data[index0 + 3];
            }
        }
    }
    if (picAmount === 4) {
        xSize = size.x / 2;
        ySize = size.y / 2;
        if (parseInt((currentIndex) / 2, 10) === 0) {
            startySize = size.y - ySize;
        } else if (parseInt((currentIndex) / 2, 10) === 1) {
            endySize = size.y - ySize;
        }
        if (currentIndex % 2 === 0) {
            endxSize = size.x - xSize;
        } else if (currentIndex % 2 === 1) {
            startxSize = size.x - xSize;
        }

        stitched = new Jimp(xSize * density, ySize * density);

        for (let y = startySize * density; y < endySize * density; y++) {
            for (let x = startxSize * density; x < endxSize * density; x++) {
                let dy = -1;
                if (y >= (size.y / 2) * density) {
                    dy = 1;
                }
                let dx = -1;
                if (x >= (size.x / 2) * density) {
                    dx = 1;
                }
                const index = ((y - startySize * density) * xSize * density + x - startxSize * density) << 2;
                // const index = ((y)* xSize * density + x ) << 2;

                const source = perspT.transformInverse((x - dx * centerDis / 2 * density), (y - dy * centerDis / 2 * density));
                // const so`urce = perspT.transformInverse((x), (y));
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
    }
    stitched.flip(false, true);

    let filename = `stitchedEach${currentIndex}.jpg`;
    filename = pathWithRandomSuffix(filename);
    return new Promise(async (resolve) => {
        await stitched.write(`${DataStorage.tmpDir}/${filename}`, () => {
            resolve({
                filename,
                xSize,
                ySize
            });
        });
    });
};

export const stitch = async (options) => {
    const { fileNames, getPoints, corners, size, centerDis } = options;
    const density = 3;
    let width, height;

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
    for (let j = 0; j < fileNames.length; j++) {
        const fileName = fileNames[j];
        const image = await readImage(`${DataStorage.tmpDir}/${fileName}`);
        width = image.bitmap.width;
        height = image.bitmap.height;
        images.push(image);
    }

    const stitched = new Jimp(size.x * density, size.y * density);
    if (fileNames.length === 4) {
        for (let y = 0; y < size.y * density; y++) {
            for (let x = 0; x < size.x * density; x++) {
                let dy = -1;
                if (y >= (size.y / 2) * density) {
                    dy = 1;
                }
                let dx = -1;
                if (x >= (size.x / 2) * density) {
                    dx = 1;
                }
                const index = (y * size.x * density + x) << 2;
                let source = perspT.transformInverse(x - dx * centerDis / 2 * density, y - dy * centerDis / 2 * density);
                let x0 = Math.round(source[0]);
                let y0 = Math.round(source[1]);

                if (x0 < 0 || y0 < 0) {
                    if (x0 < 0 && dx > -1) {
                        dx = -1;
                    }
                    if (y0 < 0 && dy > -1) {
                        dy = -1;
                    }
                    source = perspT.transformInverse(x - dx * centerDis / 2 * density, y - dy * centerDis / 2 * density);
                    x0 = Math.round(source[0]);
                    y0 = Math.round(source[1]);
                    if (x0 < 0 || y0 < 0) {
                        continue;
                    }
                } else if (x0 > width || y0 > height) {
                    if (x0 > width && dx < 1) {
                        dx = 1;
                    }
                    if (y0 > height && dy < 1) {
                        dy = 1;
                    }
                    source = perspT.transformInverse(x - dx * centerDis / 2 * density, y - dy * centerDis / 2 * density);
                    x0 = Math.round(source[0]);
                    y0 = Math.round(source[1]);
                    if (x0 > width || y0 > height) {
                        continue;
                    }
                }
                let from = dy > 0 ? 0 : 2;
                if (dx > 0) {
                    from += 1;
                }
                const index0 = (y0 * width + x0) << 2;
                stitched.bitmap.data[index] = images[from].bitmap.data[index0];
                stitched.bitmap.data[index + 1] = images[from].bitmap.data[index0 + 1];
                stitched.bitmap.data[index + 2] = images[from].bitmap.data[index0 + 2];
                stitched.bitmap.data[index + 3] = images[from].bitmap.data[index0 + 3];
            }
        }
    } else if (fileNames.length === 9) {
        for (let y = 0; y < size.y * density; y++) {
            for (let x = 0; x < size.x * density; x++) {
                let dy = -1;
                if (y >= (size.y / 2 - centerDis / 2) * density) {
                    dy = 0;
                }
                if (y >= (size.y / 2 + centerDis / 2) * density) {
                    dy = 1;
                }

                let dx = -1;
                if (x >= (size.x / 2 - centerDis / 2) * density) {
                    dx = 0;
                }
                if (x >= (size.x / 2 + centerDis / 2) * density) {
                    dx = 1;
                }
                const index = (y * size.x * density + x) << 2;
                let source = perspT.transformInverse((x - dx * centerDis * density), (y - dy * centerDis * density));
                let x0 = Math.round(source[0]);
                let y0 = Math.round(source[1]);
                if (x0 < 0 || y0 < 0) {
                    if (x0 < 0 && dx > -1) {
                        dx--;
                    }
                    if (y0 < 0 && dy > -1) {
                        dy--;
                    }
                    source = perspT.transformInverse((x - dx * centerDis * density), (y - dy * centerDis * density));
                    x0 = Math.round(source[0]);
                    y0 = Math.round(source[1]);
                    // console.log('eachtotal方向<', x, y, x0, y0);
                    if (x0 < 0 || y0 < 0) {
                        continue;
                    }
                } else if (x0 > width || y0 > height) {
                    if (x0 > width && dx < 1) {
                        dx++;
                    }
                    if (y0 > height && dy < 1) {
                        dy++;
                    }
                    source = perspT.transformInverse((x - dx * centerDis * density), (y - dy * centerDis * density));
                    x0 = Math.round(source[0]);
                    y0 = Math.round(source[1]);
                    if (x0 > width || y0 > height) {
                        continue;
                    }
                }

                const from = 4 + (-dy) * 3 + dx;
                const index0 = (y0 * width + x0) << 2;
                stitched.bitmap.data[index] = images[from].bitmap.data[index0];
                stitched.bitmap.data[index + 1] = images[from].bitmap.data[index0 + 1];
                stitched.bitmap.data[index + 2] = images[from].bitmap.data[index0 + 2];
                stitched.bitmap.data[index + 3] = images[from].bitmap.data[index0 + 3];
            }
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
