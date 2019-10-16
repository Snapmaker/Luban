import Jimp from 'jimp';
import PerspT from 'perspective-transform';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from './random-utils';

// TODO: first step in here,we get the points
async function readImage(filePath) {
    const image = await Jimp.read(filePath);
    // image.rotate(90, false).background(0x808080ff);
    // image.rotate(-90, false).background(0x808080ff);
    image.rotate(90).background(0x808080ff);
    // image.write(filePath.replace(/.jpg/,'rotate.jpg'), () => {
    //   console.log('');
    // });
    return image;
}


async function stitch(options) {
    // const {uploadName, fileNames, getPoints} = options;
    const { fileNames, getPoints, corners, size = { x: 230, y: 250, z: 235 } } = options;
    const density = 3;
    // const center = {
    //     x: size.x / 2,
    //     y: size.y / 2
    // };
    const d = 100;
    const width = 1024;
    const height = 1280;

    // phrase 1 - perspective transform matrix
    // TODO: first step in here,we get the points
    const points = [];
    for (let i = 0; i < getPoints.length; i++) {
        points.push([getPoints[i].x, getPoints[i].y]);
    }
    // console.log('points>>>>>>>>>>>>>', points);

    // await image.write(`${DataStorage.tmpDir}/marked.jpg`);
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

    // console.log('src', srcPoints);
    // console.log('dst', dstPoints);
    const perspT = PerspT(srcPoints, dstPoints);
    //TODO
    // const remapped = new Jimp(size.x * density, size.y * density);
    // const image = await readImage(`${DataStorage.tmpDir}/calibration.jpg`);
    // for (let y = 0; y < size.y * density; y++) {
    //     for (let x = 0; x < size.x * density; x++) {
    //         const index = (y * size.x * density + x) << 2;
    //         const source = perspT.transformInverse(x, y);
    //         const x0 = Math.round(source[0]);
    //         const y0 = Math.round(source[1]);
    //         // console.log(`${x0} ${y0} -> ${x} ${y}`);
    //         if (0 <= x0 && x0 < width && 0 <= y0 && y0 < height) {
    //             const index0 = (y0 * width + x0) << 2;
    //             console.log('this is index', image.bitmap.data[index0], image.bitmap.data[index0 + 1], image.bitmap.data[index0 + 2], image.bitmap.data[index0 + 3]);
    //             remapped.bitmap.data[index] = image.bitmap.data[index0];
    //             remapped.bitmap.data[index + 1] = image.bitmap.data[index0 + 1];
    //             remapped.bitmap.data[index + 2] = image.bitmap.data[index0 + 2];
    //             remapped.bitmap.data[index + 3] = image.bitmap.data[index0 + 3];
    //         }
    //     }
    // }

    // remapped.flip(false, true);

    // await remapped.write(`${DataStorage.tmpDir}/remapped.jpg`);

    // phrase 2 - stitch

    const images = [];
    for (let j = 0; j < 9; j++) {
        const fileName = fileNames[j];
        // console.log(fileName);
        // const image = await readImage(`${DataStorage.tmpDir}/${fileNames[i]}.jpg`);
        const image = await readImage(`${DataStorage.tmpDir}/${fileName}`);
        // console.log(i);
        images.push(image);
    }
    // console.log('width>>> before stitch', size.x * density, size.y * density);
    // console.log(x * density, y * density, perspT.transformInverse(x * density, y * density));
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
            // console.log('this is dx', dx, dy);

            const index = (y * size.x * density + x) << 2;
            //console.log('this is index ', index);
            const source = perspT.transformInverse(x - dx * d * density, y - dy * d * density);
            const x0 = Math.round(source[0]);
            const y0 = Math.round(source[1]);
            // console.log('this is source ', source[0], source[1]);

            if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
                // console.log(x, y, x - dx * d * density, y - dy * d * density, 'd', dx, dy, (size.y / 2 + d / 2) * density);
                continue;
                // break;
            }

            const from = 4 + (-dy) * 3 + dx;
            const index0 = (y0 * width + x0) << 2;
            // console.log('this is from ', from, index0);
            stitched.bitmap.data[index] = images[from].bitmap.data[index0];
            stitched.bitmap.data[index + 1] = images[from].bitmap.data[index0 + 1];
            stitched.bitmap.data[index + 2] = images[from].bitmap.data[index0 + 2];
            stitched.bitmap.data[index + 3] = images[from].bitmap.data[index0 + 3];
        }
    }
    // console.log('before flip', stitched);
    stitched.flip(false, true);

    let filename = 'stitched.jpg';
    filename = pathWithRandomSuffix(filename);

    await stitched.write(`${DataStorage.tmpDir}/${filename}`);
    // console.log('this is  before Promise write>>>>>>>',remapped);
    return new Promise(async (resolve) => {
        // const filename = new Date().toLocaleString() + 'stitched.jpg';
        // console.log('inside async>>>>>>>>');
        // const filename = 'stitched.jpg';
        // console.log('this is  inside Promise >>>>>>>',filename);

        await stitched.write(`${DataStorage.tmpDir}/inside${filename}`, () => {
            resolve({
                filename
            });
        });
    });
}

export default stitch;
