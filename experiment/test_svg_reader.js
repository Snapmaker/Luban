// "exp": "babel-node experiment/test_svg_reader.js",
import SvgReader from '../src/app/lib/svgreader';

const fileDir = '/Users/parachvte/Downloads/测试图片库';
// const filePath = `${fileDir}/20180426-circle4lines(forum)/circle-and-4-lines.svg`;
const filePath = '/Users/parachvte/Desktop/9e48b7e939804611c858cbb342c3330abaff411f.svg';

const svgReader = new SvgReader(0.08);
svgReader
    .parseFile(filePath)
    .then((result) => {
        const boundaries = result.boundaries;

        for (let color in boundaries) {
            const paths = boundaries[color];
            for (let path of paths) {
                console.log('path begin ====================');
                for (let j = 0; j < path.length; ++j) {
                    console.log(`(${path[j][0]}, ${path[j][1]})`);
                }
                console.log('path end ====================');
            }
        }
    });

