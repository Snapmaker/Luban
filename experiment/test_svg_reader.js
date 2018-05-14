// "exp": "babel-node experiment/test_svg_reader.js",
import fs from 'fs';
import xml2js from 'xml2js';
import SvgReader from '../src/app/lib/svgreader/svg_reader';

const fileDir = '/Users/parachvte/Downloads/测试图片库';
const filePath = `${fileDir}/20180426-circle4lines(forum)/circle-and-4-lines.svg`;


fs.readFile(filePath, 'utf8', (err, xml) => {
    if (err) {
        console.log(err);
    } else {
        xml2js.parseString(xml, (err, node) => {
            const svgReader = new SvgReader(0.08);
            const boundaries = svgReader.parse(node).boundaries;

            for (let color in boundaries) {
                let paths = boundaries[color];
                for (let path of paths) {
                    console.log('path begin ====================');
                    for (let j = 0; j < path.length; ++j) {
                        console.log(`(${path[j][0]}, ${path[j][1]})`);
                    }
                    console.log('path end ====================');
                }
            }
        });
    }
});
