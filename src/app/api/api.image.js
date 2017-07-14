import Multiparty from 'multiparty';
import fs from 'fs';
import path from 'path';

export const set = (req, res) => {
    console.log("Ooooooooooooops");
    console.log(req.files);

    let rand = Math.random();

    let filename = path.basename(req.files.image.path);

    fs.rename(req.files.image.path, `../web/images/${filename}-${rand}.jpg`, function() {
        res.send(`${filename}-${rand}.jpg`);
        res.end();
    });
};
