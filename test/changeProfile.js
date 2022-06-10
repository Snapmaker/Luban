const fs = require('fs');
const path = require('path');

function copyDirForInitSlicer(
    srcDir, inherit = false
) {
    console.log('ddd', fs.existsSync(srcDir));
    if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
            const src = path.join(srcDir, file);
            if (fs.statSync(src).isDirectory()) {
                if (!inherit) {
                    inherit = true;
                    copyDirForInitSlicer(src, inherit);
                }
            } else {
                console.log('src', src, fs.statSync(src).isDirectory(), src.indexOf('quality.') >= 0);
                if (src.indexOf('quality.') >= 0) {
                    try {
                        const data = fs.readFileSync(src, 'utf8');
                        const json = JSON.parse(data);
                        // result = JSON.parse(result);
                        if (json.overrides.speed.children.speed_print_layer_0) {
                            json.overrides.speed.children.speed_print_layer_0.default_value = 24;
                        }
                        fs.writeFileSync(src, JSON.stringify(json), 'utf8');
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        }
    }
}

copyDirForInitSlicer('../resources/CuraEngine/Config/printing/');
