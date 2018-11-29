import path from 'path';
import Jimp from 'jimp';
import PerspT from 'perspective-transform';

import { APP_CACHE_IMAGE } from '../constants';
import { pathWithRandomSuffix } from './random-utils';
// import logger from '../lib/logger';
// const log = logger('stock-remap');


function main(options) {
    console.log(`Debug: ${JSON.stringify(options)}`);
    const width = options.targetWidth * 10;
    const height = options.targetHeight * 10;
    const p0 = options.p0;
    const p1 = options.p1;
    const p2 = options.p2;
    const p3 = options.p3;
    const r = options.mm2pixelRatio;
    const h = options.height;
    // let srcCorners = [p0.x / r, p0.y / r, p1.x / r, p1.y / r, p2.x / r, p2.y / r, p3.x / r, p3.y / r];
    let srcCorners = [p3.x / r, h - p3.y / r, p2.x / r, h - p2.y / r, p1.x / r, h - p1.y / r, p0.x / r, h - p0.y / r];
    console.log(`SrcCorners: ${srcCorners}`);
    let dstCorners = [0, 0, width, 0, width, height, 0, height];
    let perspT = PerspT(srcCorners, dstCorners);
    const image = options.image;
    const filename = path.basename(image);
    const outputFilename = pathWithRandomSuffix(filename);
    return Jimp.read(image).then(originImage => new Promise(resolve => {
        let bitmap = originImage.bitmap;
        new Jimp(width, height, (err, image) => {
            let mat = [];
            for (let i = 0; i < width; ++i) {
                let arr = [];
                for (let j = 0; j < height; ++j) {
                    arr.push({cnt: 0, r: 0, g: 0, b: 0, a: 0});
                }
                mat.push(arr);
            }
            for (let i = 0; i < width; ++i) {
                for (let j = 0; j < height; ++j) {
                    let srcP = perspT.transformInverse(i, j);
                    // console.log(srcP);
                    let x = Math.floor(srcP[0]);
                    let y = Math.floor(srcP[1]);
                    let idx = y * bitmap.width * 4 + x * 4;
                    // console.log(`x: ${x}, y: ${y}`);
                    mat[i][j].cnt++;
                    mat[i][j].r += bitmap.data[idx];
                    mat[i][j].g += bitmap.data[idx + 1];
                    mat[i][j].b += bitmap.data[idx + 2];
                    mat[i][j].a += bitmap.data[idx + 3];
                }
            }
            for (let i = 0; i < width; ++i) {
                for (let j = 0; j < height; ++j) {
                    let idx = j * width * 4 + i * 4;
                    image.bitmap.data[idx] = Math.floor(mat[i][j].r / mat[i][j].cnt);
                    image.bitmap.data[idx + 1] = Math.floor(mat[i][j].g / mat[i][j].cnt);
                    image.bitmap.data[idx + 2] = Math.floor(mat[i][j].b / mat[i][j].cnt);
                    image.bitmap.data[idx + 3] = Math.floor(mat[i][j].a / mat[i][j].cnt);
                }
            }
            // console.log(image);
            image.write(`${APP_CACHE_IMAGE}/${outputFilename}`, () => {
                resolve({
                    filename: outputFilename
                });
            });
        });
    }));
}

export default main;
