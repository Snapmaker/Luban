import fs from 'fs';
import xml2js from 'xml2js';
import SvgReader from '../src/app/lib/svgreader/svg_reader';


const filePath = '/Users/parachvte/Downloads/snapjs 矢量解析错误文件/leonard/rect.svg';


const sizeWidth = 20.5, sizeHeight = 15;

fs.readFile(filePath, 'utf8', (err, xml) => {
    if (err) {
        console.log(err);
    } else {
        xml2js.parseString(xml, (err, node) => {
            let svgReader = new SvgReader(0.08, [sizeWidth, sizeHeight]);
            svgReader.parse(node);
            const boundaries = svgReader.boundaries;

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
