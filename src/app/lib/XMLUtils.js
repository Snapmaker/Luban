import fs from 'fs';
import xml2js from 'xml2js';


const readFile = (path, callback) => {
    fs.readFile(path, 'utf8', (err, xml) => {
        if (err) {
            callback(err, null);
            return;
        }

        xml2js.parseString(xml, (err, node) => {
            callback(err, node);
        });
    });
};

export default {
    readFile
};
