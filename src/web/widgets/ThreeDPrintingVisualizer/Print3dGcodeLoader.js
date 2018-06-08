//
// 解析 Gcode 的思路
// 注意：
// -1 此函数，不是为了解析通用 Gcode，而是为了专门用于解析 CuraEngine 生成的 Gcode
// -2 CuraEngine 生成的 Gcode 含有的注释信息，用于标识 gcode 的 type，如 support 或者 wall outer。不同的 type 要渲染成不同的颜色
// -3 travel 的 cmd，gcode文件中没有做区分。但是可以通过代码区分。也就是：support的路径中，同时包含【 打印 和 travel 】
// -4 如何判断 travel？此行 cmd 为 G0/G1，但是不包含 e，则为 travel
// -5 如何判断回抽？此行 cmd 为 G0/G1，且包含 e，但当前 e 的值小于上一个 e    todo：回抽的同时 z hop。要在渲染路径上看的到才可以
// -6 travel 和回抽，z hop 如何渲染？都不吐料，渲染成同一种颜色
// -7 注意 G92
// -8 为了简化逻辑，解析之前，人为添加自定义的type：Travel。将 Travel 也认为是一种 type
// -9 渲染开始的标志：G28。注意 G28 有两种格式
// -10 渲染的结束：直到 Gcode 文件的最后一行
// -11 控制显示的两种方式：
//         1. 显示某些层
//         2. 显示某些 type
// -12 两种显示方式是交叉的，因此需要增加变量，用于控制 visiblity

// step-0 预处理：人为添加自定义的 type（通过注释）：Travel
// step-1 读取 gcode 文件，按行解析，得到一个个的 vertice，存储在 vertice buffer 中
// step-2 在合适的时候，将 vertice buffer 生成一条线，将线存储在 line buffer 中。
// 清空 vertice buffer，并且保留最后一个点
// 保留最后一个点的原因：例如：A-->B--->C-->D   A，B，C 构成一条线，C，D 构成一条线
// 合适的时候？layer changed 和 type changed 的时候
// step-3 在合适的时候（ layer changed ），处理 line buffer，生成一个 Layer instance
// step-4 解析到最后一行的时候，要处理 vertice buffer 和 line buffer 的数据

// layers：存储 layer 的数组

// layer 的属性：
//      lines[]  一层有很多条线
//      index    由下到上，从 1 开始
//      z
//      name

// line 的属性：
//      gemotry + material
//      userData ：type（gcode 的 type）    index：等于 layer 的 index


import * as THREE from 'three';

function Layer(lines, index, z, name) {
    this.lines = lines;
    this.index = index;
    this.z = z;
    this.name = name;
}
function LineUserData(type, index) {
    this.type = type;
    this.index = index;
}
function Print3dGcodeLoader(manager) {
    this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
    this.init();

    this.parse = this.parse.bind(this);
}

Print3dGcodeLoader.prototype.init = function() {
    this.visibleLayerCount = 0;
    this.layer_height = 0.2;
    this.layerCount = 0;
    this.state = { x: -Infinity, y: -Infinity, z: -Infinity, e: 0, f: 0, line_type: 'UNKNOWN', layer_index: -Infinity };
    this.layers = [];
    this.materials = {
        'WALL-INNER': new THREE.LineBasicMaterial({ color: 0x00FF00, linewidth: 2 }), // Sun_green
        'WALL-OUTER': new THREE.LineBasicMaterial({ color: 0xFF2121, linewidth: 2 }), // Sun_red
        'SKIN': new THREE.LineBasicMaterial({ color: 0xFFFF00, linewidth: 2 }), // Sun_yellow
        'SKIRT': new THREE.LineBasicMaterial({ color: 0xFa8c35, linewidth: 2 }), // Sun_orange
        'SUPPORT': new THREE.LineBasicMaterial({ color: 0x4b0082, linewidth: 2 }), // Sun_indigo
        'FILL': new THREE.LineBasicMaterial({ color: 0x8d4bbb, linewidth: 2 }), // Sun_purple
        'Travel': new THREE.LineBasicMaterial({ color: 0x44cef6, linewidth: 2 }), // Sun_blue;
        'UNKNOWN': new THREE.LineBasicMaterial({ color: 0x4b0082, linewidth: 2 }) // Sun_indigo
    };
    // line array: split by line type
    this.typeLineArrays = {
        'WALL-INNER': [],
        'WALL-OUTER': [],
        'SKIN': [],
        'SKIRT': [],
        'SUPPORT': [],
        'FILL': [],
        'Travel': [],
        'UNKNOWN': []
    };
    this.typeVisibility = {
        'WALL-INNER': true,
        'WALL-OUTER': true,
        'SKIN': true,
        'SKIRT': true,
        'SUPPORT': true,
        'FILL': true,
        'Travel': true,
        'UNKNOWN': true
    };
    this.shouldUpdateBoundary = false;
    this.minX = Number.MAX_VALUE;
    this.minY = Number.MAX_VALUE;
    this.minZ = Number.MAX_VALUE;
    this.maxX = Number.MIN_VALUE;
    this.maxY = Number.MIN_VALUE;
    this.maxZ = Number.MIN_VALUE;
};

Print3dGcodeLoader.prototype.load = function (url, onLoad) {
    const parse = this.parse;

    const loader = new THREE.FileLoader(this.manager);
    loader.load(
        url,
        (text) => {
            onLoad(parse(text));
        }
    );
};
// show those layers
Print3dGcodeLoader.prototype.showLayers = function (count) {
    count = (count < 0 ? 0 : count);
    count = (count > this.layerCount ? this.layerCount : count);

    this.visibleLayerCount = count;
    for (let i = 0, layersLength = this.layers.length; i < layersLength; i++) {
        const layer = this.layers[i];
        const index = layer.index;
        for (let k = 0, lineCount = layer.lines.length; k < lineCount; k++) {
            const type = layer.lines[k].userData.type;
            layer.lines[k].visible = this.typeVisibility[type] && (index <= this.visibleLayerCount);
        }
    }
};
// show those lines of this type which [line.userData <= this.visibleLayerCount]
Print3dGcodeLoader.prototype.showType = function (type) {
    if (!this.typeLineArrays[type]) {
        console.warn('THREE.Print3dGcodeLoader: error type:' + type);
        return;
    }

    const lineArray = this.typeLineArrays[type];
    for (let i = 0, l = lineArray.length; i < l; i++) {
        lineArray[i].visible = (lineArray[i].userData.index <= this.visibleLayerCount);
    }
    this.typeVisibility[type] = true;
};
// hide all lines of this type
Print3dGcodeLoader.prototype.hideType = function (type) {
    if (this.typeLineArrays[type] === undefined) {
        console.warn('THREE.Print3dGcodeLoader: error type:' + type);
        return;
    }
    const lineArray = this.typeLineArrays[type];
    for (let i = 0, l = lineArray.length; i < l; i++) {
        lineArray[i].visible = false;
    }
    this.typeVisibility[type] = false;
};
Print3dGcodeLoader.prototype.parse = function (data) {
    this.init();

    const vertexBuffer = [];
    const lineBuffer = [];
    const object = new THREE.Group();
    object.name = 'gcode';
    let startRender = false;

    const newLine = () => {
        if (vertexBuffer.length === 0) {
            return;
        }
        const geometry = new THREE.Geometry();

        // deep copy
        geometry.vertices = vertexBuffer.concat();
        // clear
        vertexBuffer.splice(0, vertexBuffer.length);

        // add last vertex
        vertexBuffer.push(geometry.vertices[geometry.vertices.length - 1]);

        const type = this.state.line_type;

        // select color by type
        const material = this.materials[type] || this.materials.UNKNOWN;
        const line = new THREE.Line(geometry, material);
        line.userData = new LineUserData(type, this.layerCount);

        lineBuffer.push(line);

        this.typeLineArrays[type].push(line);

        object.add(line);
    };
    const newLayer = () => {
        if (lineBuffer.length === 0) {
            return;
        }

        this.layerCount++;

        // deep copy
        const lines = lineBuffer.concat();
        // clear
        lineBuffer.splice(0, lineBuffer.length);

        const layer = new Layer(lines, this.layerCount, this.state.z);
        this.layers.push(layer);
    };

    const gcodeLines = data.split('\n');

    for (let i = 0, l = gcodeLines.length; i < l; i++) {
        let gcodeLine = gcodeLines[i].trim();

        // 1. ignore empty string
        if (gcodeLine.length === 0) {
            continue;
        }

        // 2. filter key word: ;TYPE: & ;LAYER: & ;Layer height: & ;Start GCode end & ;End GCode begin
        if (gcodeLine.indexOf(';TYPE:') === 0) {
            const lineType = gcodeLine.replace(';TYPE:', '').trim();
            if (lineType !== this.state.line_type) {
                newLine();
            }
            this.state.line_type = lineType;
            continue;
        } else if (gcodeLine.indexOf(';LAYER:') === 0) {
            let layerIndex = parseInt(gcodeLine.replace(';LAYER:', ''), 0);
            if (layerIndex !== this.state.layer_index) {
                newLine();
                newLayer();
            }
            this.state.layer_index = layerIndex;
            continue;
        } else if (gcodeLine.indexOf(';Layer height:') === 0) {
            this.layer_height = parseFloat(gcodeLine.replace(';Layer height:', ''));
            continue;
        } else if (gcodeLine.indexOf(';Start GCode end') === 0) {
            this.shouldUpdateBoundary = true;
        } else if (gcodeLine.indexOf(';End GCode begin') === 0) {
            this.shouldUpdateBoundary = false;
        }

        // 3. ignore comments
        if (gcodeLine.indexOf(';') !== -1) {
            gcodeLine = gcodeLine.split(';')[0];
        }

        const tokens = gcodeLine.split(' '); // G1,F1080,X91.083,Y66.177,E936.7791
        const cmd = tokens[0].toUpperCase(); // G0 or G1 or G92 or M107
        // Arguments
        const args = {};
        tokens.splice(1).forEach((token) => {
            if (token[0] !== undefined) {
                const key = token[0].toLowerCase(); // G/M
                const value = parseFloat(token.substring(1));
                args[key] = value; // {"f":990,"x":39.106,"y":73.464,"e":556.07107}
            }
        });
        // Process commands
        if (cmd === 'G28') {
            // G28: http://marlinfw.org/docs/gcode/G028.html
            // (x=0 && y=0 && z=0) is mark of start render
            this.state.x = 0;
            this.state.y = 0;
            this.state.z = 0;

            startRender = true;
            console.log('startRender ...');

            // TODO : 2 cases
            // case-1 : G28
            // case-2 : G28 X0
        } else if (cmd === 'G0' || cmd === 'G1') {
            if (!startRender) {
                continue;
            }
            this.state.x = (args.x || this.state.x);
            this.state.y = (args.y || this.state.y);
            this.state.z = (args.z || this.state.z);
            // Attention : switch y <====> z
            vertexBuffer.push(new THREE.Vector3(this.state.x, this.state.z, -this.state.y));

            if (this.shouldUpdateBoundary) {
                this.minX = Math.min(this.state.x, this.minX);
                this.minY = Math.min(this.state.y, this.minY);
                this.minZ = Math.min(this.state.z, this.minZ);

                this.maxX = Math.max(this.state.x, this.maxX);
                this.maxY = Math.max(this.state.y, this.maxY);
                this.maxZ = Math.max(this.state.z, this.maxZ);
            }
        } else if (cmd === 'G2' || cmd === 'G3') {
            // G2/G3 - Arc Movement ( G2 clock wise and G3 counter clock wise )
            console.warn('THREE.Print3dGcodeLoader: Arc command not supported');
        } else if (cmd === 'G90') {
            // G90: Set to Absolute Positioning
        } else if (cmd === 'G91') {
            // G91: Set to state.relative Positioning
        } else if (cmd === 'G92') {
            // G92: Set Position
        } else {
            // console.warn( 'THREE.Print3dGcodeLoader: Command not supported:' + cmd );
        }
    }
    // process buffer
    newLine();
    newLayer();
    // object.rotation.set(Math.PI / 2, 0, 0);
    return object;
};

export default Print3dGcodeLoader;
