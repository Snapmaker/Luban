import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';

function generate_greyscale(param, cb) {
    const { dwellTime, quality, imageSrc, sizeWidth, sizeHeight } = param;
    const imageWidth = sizeWidth * quality;
    const imageHeight = sizeHeight * quality;

    let filename = path.basename(imageSrc);
    let content = '';
    content += 'G90\n';
    content += 'G21\n';
    content += 'F288\n';

    Jimp.read(`../web/images/${filename}`, (err, doggy) => {
        doggy.resize(parseFloat(imageWidth), parseFloat(imageHeight))
            .flip(false, true)
            .scan(0, 0, doggy.bitmap.width, doggy.bitmap.height, (x, y, idx) => {
                if (doggy.bitmap.data[idx] < 128) {
                    content += `G0 X${x / quality} Y${y / quality}\n`;
                    content += 'M03\n';
                    content += `G4 P${dwellTime}\n`;
                    content += 'M05\n';
                }
            }, () => {
                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    cb(`${filename}.gcode`);
                });
            });
    });
}


function extract_segment(data, start, box, direction, sign) {
    let len = 1;
    function idx(pos) {
        return pos.x * 4 + pos.y * box.width * 4;
    }
    while (true) {
        let cur = {
            x: start.x + direction.x * len * sign,
            y: start.y + direction.y * len * sign
        }
        if (data[idx(cur)] !== data[idx(start)]
        || cur.x < 0 || cur.x >= box.width
        || cur.y < 0 || cur.y >= box.height) {
            break;
        }
        len += 1
    }
    return len;
}

function gen_movement(start, direction, sign, len, jogSpeed, workSpeed) {
    let content = '';
    let end = {
        x: start.x + direction.x * len * sign,
        y: start.y + direction.y * len * sign
    }

    content += `G0 X${start.x / 10} Y${start.y / 10} F${jogSpeed}\n`;
    content += 'M03\n';
    content += `G1 X${end.x / 10} Y${end.y / 10} F${workSpeed}\n`;
    content += 'M05';

    return content;
}
function gen_start() {
    let content = '';

    content += 'G90\n';
    content += 'G21\n';
    content += 'F288\n';

    return content;
}


function generate_bw(param, cb) {
    const { quality, imageSrc, sizeWidth, sizeHeight, direction } = param;
    const imageWidth = sizeWidth * quality;
    const imageHeight = sizeHeight * quality;

    let filename = path.basename(imageSrc);

    Jimp.read(`../web/images/${filename}`, function(err, lego) {
        if (err) {
            throw err;
        }
        lego.flip(false, true, () => {
            let content = gen_start();

            if (direction === 'Horizontal') {
                let direction = {
                    x: 1,
                    y: 0
                };
                for (let j =0; j < lego.bitmap.height; ++j) {
                    let len = 0;
                    const isRerverse = (j % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let i = (isRerverse ? lego.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < lego.bitmap.width; i += len * sign) {
                        let idx = i * 4 + j * lego.bitmap.width * 4;
                        if (lego.bitmap.data[idx] <= 128) {
                            const start = {
                                x: i,
                                y: j
                            };
                            len = extract_segment(lego.bitmap.data,
                                start,
                                lego.bitmap,
                                direction, sign);
                            //console.log(`${i} ${j} ${len}`)
                            content += gen_movement(start, direction, sign, len, 0, 0);
                        } else {
                            len = 1;
                        }
                    }
                }

                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    console.log('Horizonal.gcode generated');
                    cb(`${filename}.gcode`);
                });
            }

            if (direction === 'Vertical') {
                let direction = {
                    x: 0,
                    y: 1
                };

                for (let i = 0; i < lego.bitmap.width; ++i) {
                    let len = 0;
                    const isRerverse = (i % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let j = (isRerverse ? lego.bitmap.height - 1 : 0);
                        isRerverse ? j >= 0 : j < lego.bitmap.height; j += len * sign) {
                        let idx = i * 4 + j * lego.bitmap.width * 4;

                        if (lego.bitmap.data[idx] <= 128) {
                            const start = {
                                x: i,
                                y: j
                            };

                            len = extract_segment(lego.bitmap.data,
                                start,
                                lego.bitmap,
                                direction,
                                sign);

                            content += gen_movement(start, direction, sign, len, 0, 0);

                        } else {
                            len = 1;
                        }
                    }
                }

                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    console.log('Vertical.gcode generated')
                    cb(`${filename}.gcode`);
                });
            }

            if (direction === 'diagonal') {
                let direction = {
                    x: 1,
                    y: -1
                }

                for (let k = 0; k < lego.bitmap.width + lego.bitmap.height - 1; ++k) {
                    let len = 0;
                    const isRerverse = (k % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let i = (isRerverse ? lego.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < lego.bitmap.width; i += len * sign) {
                        let j = k - i;
                        if (j < 0 || j > lego.bitmap.height) {
                            len = 1;

                            // can't break the loop
                            continue;
                        }

                        let idx = i * 4 + j * lego.bitmap.width * 4;

                        if (lego.bitmap.data[idx] <= 128) {
                            let start = {
                                x: i,
                                y: j
                            }
                            len = extract_segment(lego.bitmap.data,
                                start,
                                lego.bitmap,
                                direction,
                                sign);
                            //console.log(`${i} ${j} ${len}`)
                            content += gen_movement(start, direction, sign, len, 0, 0);

                        } else {
                            len = 1;
                        }
                    }
                }

                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    console.log('diagonal generated');
                    cb(`${filename}.gcode`);
                });
            }

            if (direction === 'diagonal2') {
                let direction = {
                    x: 1,
                    y: 1
                }

                for (let k = -lego.bitmap.height; k <= lego.bitmap.width; ++k) {
                    const isRerverse = (k % 2 !== 0);
                    sign = isRerverse ? -1 : 1;
                    let len = 0;
                    for (let i = (isRerverse ? lego.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < lego.bitmap.width;
                        i += len * sign) {
                        let j = i - k;
                        if (j < 0 || j > lego.bitmap.height) {
                            len = 1;

                            // can't break the loop
                            continue;
                        }

                        let idx = i * 4 + j * lego.bitmap.width * 4;

                        if (lego.bitmap.data[idx] <= 128) {
                            let start = {
                                x: i,
                                y: j
                            }
                            len = extract_segment(lego.bitmap.data,
                                start,
                                lego.bitmap,
                                direction,
                                sign);
                            //console.log(`${i} ${j} ${len}`)

                            content += gen_movement(start, direction, sign, len, 0, 0);

                        } else {
                            len = 1;
                        }
                    }
                }

                fs.writeFile(`../web/images/${filename}.gcode`, content, () => {
                    console.log('diagonal2 generated');
                    cb(`${filename}.gcode`);
                });
            }
        });
    });
}

function generate(param, cb) {
    if (param.mode == 'greyscale') {
        generate_greyscale(param, cb);
    } else {
        generate_bw(param, cb);
    }
}

export default generate;
