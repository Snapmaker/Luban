const Jimp = require('jimp');

const th = 30;
const visited = 0;

let bin = null;

Jimp.read('./lines-black.png', (err, img) => {
    if (err) {
        throw err;
    }
    const width = 200;
    const height = 100;
    img.resize(width, height);
    bin = getMask(img, th);
    const minIndex = countPixel(bin);
    // console.log('minIndex', minIndex);
});

function countPixel(image) {
    const { width, height, data } = image.bitmap;
    const dx = [-1, 0, 0, 1];
    const dy = [0, -1, 1, 0];
    // const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
    // const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
    // const spots = new Array(21);
    const spots = [];
    const visited = getArray2D(width, height, 0);

    let count = 0;
    for (let i = 1; i < width - 1; i++) {
        for (let j = 1; j < height - 1; j++) {
            const id = j * width * 4 + i * 4;
            if (data[id] === 0 && !visited[i][j]) {
                count = 1;
                const q = [];
                q.push({ x: i, y: j });
                while (q.length > 0) {
                    const p = q.pop();
                    for (let k = 0; k < 4; k++) {
                        const i2 = p.x + dx[k];
                        const j2 = p.y + dy[k];
                        const id2 = j2 * width * 4 + i2 * 4;
                        if (0 < i2 && i2 < width - 1 && 0 < j2 && j2 < height - 1 && data[id2] === 0 && !visited[i2][j2]) {
                            q.push({ x: i2, y: j2 });
                            visited[i2][j2] = 1;
                            count++;
                        }
                    }
                }
                if (count > 20) {
                    spots.push(count);
                }
            }
        }
    }
    let minIndex = 0;
    let minCount = Number.MAX_VALUE;
    for (let i = 0; i < spots.length; i++) {
        let k = i % 5 === 0 ? Math.ceil(spots[i] / 2) : spots[i];
        if (k < minCount) {
            minIndex = i;
            minCount = k;
        }
    }
    return minIndex;
}

function getArray2D(width, height, value) {
    const a = [];
    for (let i = 0; i < width; i++) {
        const sub = [];
        for (let j = 0; j < height; j++) {
            sub.push(value);
        }
        a.push(sub);
    }
    return a;
}

function getMask(image, maskThreshold) {
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const kernel = createGaussianKernel(7, 1.5);
    const imageBlur = image.clone();
    imageBlur.convolute(kernel);
    const greyscaleBlur = imageBlur.clone().greyscale();
    const greyscale = image.clone().greyscale();
    const binarization = new Jimp(width, height);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const index = j * width * 4 + i * 4;
            const value = greyscale.bitmap.data[index];
            const valueBlur = greyscaleBlur.bitmap.data[index];
            const valueDiff = value - valueBlur;
            if (valueDiff >= maskThreshold || greyscale.bitmap.data[index + 3] === 0) {
                imageBitSet(binarization, index, 255);
            } else {
                imageBitSet(binarization, index, 0);
            }
        }
    }
    return binarization;
}

function createGaussianKernel(n, sigma) {
    sigma = Math.max(sigma, 0);
    let sum = 0;
    const scale = -0.5 / (sigma * sigma);
    const n2 = Math.floor(n / 2);
    const kernel = [];
    for (let i = 0; i < n; i++) {
        const values = [];
        for (let j = 0; j < n; j++) {
            const d2 = (i - n2) * (i - n2) + (j - n2) * (j - n2);
            values.push(Math.exp(d2 * scale));
            sum += values[j];
        }
        kernel.push(values);
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            kernel[i][j] /= sum;
        }
    }
    return kernel;
}

function imageBitSet(image, index, r, g, b, a) {
    g = (g === undefined) ? r : g;
    b = (b === undefined) ? r : b;
    a = (a === undefined) ? 255 : a;

    const data = image.bitmap.data;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
}
