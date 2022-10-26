/* eslint-disable */

const Jimp = require('jimp');
const fs = require('fs');
const { cv } = require('opencv-wasm');
import sendMessage from '../utils/sendMessage';

let initialized = false;
let jobs = []
let map_x, map_y;
let Tmpdir, ConfigDir = ''

const remap = async () => {
    const job = jobs.shift()
    const { fileName } = job
    let src, dst
    try {
        const jimpSrc = await Jimp.read(`${Tmpdir}/${fileName}`);
        src = cv.matFromImageData(jimpSrc.bitmap);

        dst = new cv.Mat();
        cv.remap(src, dst, map_x, map_y, cv.INTER_LINEAR,);
        const result = new Jimp({
            width: dst.cols,
            height: dst.rows,
            data: Buffer.from(dst.data)
        })
        const outputFileName = `remaped_${fileName}`
        result.write(`${Tmpdir}/${outputFileName}`);
        src.delete();
        dst.delete();
        sendMessage({ status: 'complete', input: fileName, output: outputFileName })
    } catch (error) {
        console.error(error)
        if (src) {
            src.delete();
        }
        if (dst) {
            dst.delete();
        }
        sendMessage({ status: 'error', input: fileName })

        // jobs.unshift(job)
        // remap()
    }
}

const imageRemap = (fileName, series, materialThickness, _Tmpdir, _ConfigDir) => {
    return new Promise(async (resolve) => {
        Tmpdir = _Tmpdir;
        ConfigDir = _ConfigDir;
        if (!initialized) {
            await onRuntimeInitialized(series)
        }
        jobs = [{
            fileName
        }]
        await remap()

        resolve()
    })

}
async function onRuntimeInitialized(series) {
    let txt_x = await fs.readFileSync(`${ConfigDir}/mapx_${series}.txt`, { encoding: 'utf8' });
    let txt_y = await fs.readFileSync(`${ConfigDir}/mapy_${series}.txt`, { encoding: 'utf8' });

    let arr_x = txt_x.split(/\s/).filter(i => i).map(j => Number(j));
    let arr_y = txt_y.split(/\s/).filter(i => i).map(j => Number(j));
    map_x = cv.matFromArray(1280, 1024, cv.CV_16SC2, arr_x);
    map_y = cv.matFromArray(1280, 1024, cv.CV_16UC1, arr_y);

    txt_x = null;
    txt_y = null;
    arr_x = null;
    arr_y = null;

    initialized = true;
}
export default imageRemap;