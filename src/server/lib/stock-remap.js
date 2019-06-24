import path from 'path';
import Jimp from 'jimp';
import PerspT from 'perspective-transform';
import { pathWithRandomSuffix } from './random-utils';
import DataStorage from '../DataStorage';

function main(options) {
    const width = options.targetWidth * 3;
    const height = options.targetHeight * 3;
    const p0 = options.p0;
    const p1 = options.p1;
    const p2 = options.p2;
    const p3 = options.p3;
    const r = options.mm2pixelRatio;
    const h = options.height;
    // let srcCorners = [p0.x / r, p0.y / r, p1.x / r, p1.y / r, p2.x / r, p2.y / r, p3.x / r, p3.y / r];
    const srcCorners = [p3.x / r, h - p3.y / r, p2.x / r, h - p2.y / r, p1.x / r, h - p1.y / r, p0.x / r, h - p0.y / r];
    const dstCorners = [0, 0, width, 0, width, height, 0, height];
    const perspT = PerspT(srcCorners, dstCorners);

    const imagePath = options.image;
    const filename = path.basename(imagePath);
    const outputFilename = pathWithRandomSuffix(filename);

    return Jimp.read(imagePath).then(originImage => new Promise(resolve => {
        const bitmap = originImage.bitmap;
        // creating new images:
        // ref: https://github.com/oliver-moran/jimp/tree/master/packages/jimp
        /* eslint-disable no-new */
        new Jimp(width, height, (err, image) => {
            const mat = [];
            for (let i = 0; i < width; ++i) {
                const arr = [];
                for (let j = 0; j < height; ++j) {
                    arr.push({ cnt: 0, r: 0, g: 0, b: 0, a: 0 });
                }
                mat.push(arr);
            }
            for (let i = 0; i < width; ++i) {
                for (let j = 0; j < height; ++j) {
                    const srcP = perspT.transformInverse(i, j);
                    const x = Math.floor(srcP[0]);
                    const y = Math.floor(srcP[1]);
                    const idx = y * bitmap.width * 4 + x * 4;
                    mat[i][j].cnt++;
                    mat[i][j].r += bitmap.data[idx];
                    mat[i][j].g += bitmap.data[idx + 1];
                    mat[i][j].b += bitmap.data[idx + 2];
                    mat[i][j].a += bitmap.data[idx + 3];
                }
            }
            for (let i = 0; i < width; ++i) {
                for (let j = 0; j < height; ++j) {
                    const idx = j * width * 4 + i * 4;
                    image.bitmap.data[idx] = Math.floor(mat[i][j].r / mat[i][j].cnt);
                    image.bitmap.data[idx + 1] = Math.floor(mat[i][j].g / mat[i][j].cnt);
                    image.bitmap.data[idx + 2] = Math.floor(mat[i][j].b / mat[i][j].cnt);
                    image.bitmap.data[idx + 3] = Math.floor(mat[i][j].a / mat[i][j].cnt);
                }
            }
            image.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
                resolve({
                    filename: outputFilename
                });
            });
        });
    }));
}

export default main;
