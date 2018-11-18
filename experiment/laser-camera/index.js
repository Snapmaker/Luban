let PerspT = require('perspective-transform');
let Jimp = require('jimp');

// function testApi() {
//     let srcCorners = [158, 64, 494, 69, 495, 404, 158, 404];
//     let dstCorners = [100, 500, 152, 564, 148, 604, 100, 560];
//     let perspT = PerspT(srcCorners, dstCorners);
//     let srcPt = [250, 120];
//     let dstPt = perspT.transform(srcPt[0], srcPt[1]);
//     console.log(dstPt);
// }

function testPoint() {
    // p0: 131, 5;
    // p2: 256. 5;
    // p3: 162, 390
    // p4: 7, 320
    Jimp.read('./experiment/laser-camera/in.png').then(image => {
        image.crop(131, 5, 50, 50).write('./experiment/laser-camera/out1.png');
    });

    Jimp.read('./experiment/laser-camera/in.png').then(image => {
        image.crop(258, 16, 50, 50).write('./experiment/laser-camera/out2.png');
    });

    Jimp.read('./experiment/laser-camera/in.png').then(image => {
        image.crop(162, 390, 50, 50).write('./experiment/laser-camera/out3.png');
    });
    Jimp.read('./experiment/laser-camera/in.png').then(image => {
        image.crop(7, 340, 50, 50).write('./experiment/laser-camera/out4.png');
    });
}


function main() {

    const width = 400;
    const height = 800;

    let srcCorners = [131, 5, 256, 16, 162, 390, 7, 340];
    let dstCorners = [0, 0, width, 0, width, height, 0, height];
    let perspT = PerspT(srcCorners, dstCorners);

    // console.log(perspT.transformInverse(0, 200));
    Jimp.read('./experiment/laser-camera/in.png').then(originImage => {
        let bitmap = originImage.bitmap;
        new Jimp(width, height, (err, image) => {
            let mat = [];
            for (let i = 0; i < width; ++i) {
                let arr = [];
                for (let j = 0; j < height; ++j) {
                    arr.push({ cnt: 0, r: 0, g: 0, b: 0, a: 0 });
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
            image.write('./experiment/laser-camera/out-final.png');
        });
    });
}


main();

// testApi();
// testPoint();

