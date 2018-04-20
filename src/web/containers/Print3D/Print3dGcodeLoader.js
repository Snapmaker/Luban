/* eslint-disable */

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
import 'imports-loader?THREE=three!three/examples/js/controls/TransformControls';

function Layer (lines, index, z, name) {
    this.lines = lines;
    this.index = index;
    this.z = z;
    this.name = name;
}
function LineUserData (type, index) {
    this.type = type;
    this.index = index;
}
THREE.Print3dGcodeLoader = function (manager) {
    this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
    this.init();
};
THREE.Print3dGcodeLoader.prototype.init = function() {
    this.visibleLayerCount = 0;
    this.layer_height = 0.2;
    this.layerCount = 0;
    this.state = { x: -Infinity, y: -Infinity, z: -Infinity, e: 0, f: 0, line_type: 'UNKNOWN', layer_index: -Infinity };
    this.layers = [];
    this.materials = {
        'WALL-INNER': new THREE.LineBasicMaterial({ color: 0x00FF00, linewidth: 2 }), //Sun_green
        'WALL-OUTER': new THREE.LineBasicMaterial({ color: 0xFF2121, linewidth: 2 }), //Sun_red
        'SKIN': new THREE.LineBasicMaterial({ color: 0xFFFF00, linewidth: 2 }), //Sun_yellow
        'SKIRT': new THREE.LineBasicMaterial({ color: 0xFa8c35, linewidth: 2 }), //Sun_orange
        'SUPPORT': new THREE.LineBasicMaterial({ color: 0x4b0082, linewidth: 2 }), //Sun_indigo
        'FILL': new THREE.LineBasicMaterial({ color: 0x8d4bbb, linewidth: 2 }), //Sun_purple
        'Travel': new THREE.LineBasicMaterial({ color: 0x44cef6, linewidth: 2 }), //Sun_blue;
        'UNKNOWN': new THREE.LineBasicMaterial({ color: 0x4b0082, linewidth: 2 }) //Sun_indigo
    };
    //line array: split by line type
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
    // function onProgress() {
    // }
};
THREE.Print3dGcodeLoader.prototype.load = function (url, onLoad, onProgress) {
    var scope = this;
    scope.onProgress = onProgress;

    var loader = new THREE.FileLoader(scope.manager);
    loader.load(
        url,
        (text) => {
            onLoad(scope.parse(text));
        }
        // ,
        // onProgress,
        // onError
    );
};
//show those layers
THREE.Print3dGcodeLoader.prototype.showLayers = function (count) {
    count = (count < 0 ? 0 : count);
    count = (count > this.layerCount ? this.layerCount : count);

    this.visibleLayerCount = count;
    for (var i = 0; i < this.layers.length; i++) {
        var index = this.layers[i].index;
        for (var k = 0; k < this.layers[i].lines.length; k++) {
            var type = this.layers[i].lines[k].userData.type;
            var visible = (index <= this.visibleLayerCount) && this.typeVisibility[type];
            this.layers[i].lines[k].visible = visible;
        }
    }
};
//show those lines of this type which [line.userData <= this.visibleLayerCount]
THREE.Print3dGcodeLoader.prototype.showType = function (type) {
    if (!this.typeLineArrays[type]) {
        console.warn('THREE.Print3dGcodeLoader: error type:' + type);
        return;
    }

    var lineArray = this.typeLineArrays[type];
    for (var i = 0; i < lineArray.length; i++) {
        lineArray[i].visible = (lineArray[i].userData.index <= this.visibleLayerCount);
    }
    this.typeVisibility[type] = true;
};
//hide all lines of this type
THREE.Print3dGcodeLoader.prototype.hideType = function (type) {
    if (this.typeLineArrays[type] === undefined) {
        console.warn('THREE.Print3dGcodeLoader: error type:' + type);
        return;
    }
    var lineArray = this.typeLineArrays[type];
    for (var i = 0; i < lineArray.length; i++) {
        lineArray[i].visible = false;
    }
    this.typeVisibility[type] = false;
};
THREE.Print3dGcodeLoader.prototype.parse = function (data) {
    this.init();
    var scope = this;
    var verticeBuffer = [];
    var lineBuffer = [];
    var object = new THREE.Group();
    object.name = 'gcode';
    var startRender = false;
    function newLine() {
        if (verticeBuffer.length === 0) {
            return;
        }
        var geometry = new THREE.Geometry();

        //deep copy
        geometry.vertices = verticeBuffer.concat();
        //clear
        verticeBuffer.splice(0, verticeBuffer.length);

        //add last vertice
        verticeBuffer.push(geometry.vertices[geometry.vertices.length - 1]);

        var type = scope.state.line_type;

        //select color by type
        var material = scope.materials[type] || scope.materials.UNKNOWN;
        var line = new THREE.Line(geometry, material);
        line.userData = new LineUserData(type, scope.layerCount);

        lineBuffer.push(line);

        scope.typeLineArrays[type].push(line);

        object.add(line);
    }
    function newLayer () {
        if (lineBuffer.length === 0) {
            return;
        }

        scope.layerCount ++;

        //deep copy
        var lines = lineBuffer.concat();
        //clear
        lineBuffer.splice(0, lineBuffer.length);

        var layer = new Layer(lines, scope.layerCount, scope.state.z);

        scope.layers.push(layer);
    }
    var gcodeLines = data.split('\n');
    var lastType = 'UNKNOWN';
    var isTraveling = false;
    var event = {
        total: gcodeLines.length,
        loaded: 0
    };
    // for (var k = 0; k < gcodeLines.length; k++) {
    //     event.loaded = k;
    //     scope.onProgress(event);
    //     let gcodeLine = gcodeLines[k];
    //     if (gcodeLine.trim().indexOf(';TYPE:') === 0) {
    //         lastType = gcodeLine.replace(';TYPE:', '');
    //         continue;
    //     }
    //     if (gcodeLine.trim().indexOf('G0') === 0 || gcodeLine.trim().indexOf('G1') === 0) {
    //         if (gcodeLine.split(';')[0].indexOf('E') === -1) {
    //             if (isTraveling) {
    //                 continue;
    //             }
    //             isTraveling = true;
    //             gcodeLines.splice(k, 0, ';TYPE:Travel');
    //             k++;
    //         } else {
    //             if (!isTraveling) {
    //                 continue;
    //             }
    //             isTraveling = false;
    //             gcodeLines.splice(k, 0, ';TYPE:' + lastType);
    //             k++;
    //         }
    //     }
    // }
    for (var i = 0; i < gcodeLines.length; i++) {
        var gcodeLine = gcodeLines[i];
        // 1. filter key word: ;TYPE: & ;LAYER: & ;Layer height:
        if (gcodeLine.trim().indexOf(';TYPE:') === 0) {
            let lineType = gcodeLine.replace(';TYPE:', '');
            if (lineType !== scope.state.line_type) {
                newLine();
            }
            scope.state.line_type = lineType;
            continue;
        } else if (gcodeLine.trim().indexOf(';LAYER:') === 0) {
            let layerIndex = parseInt(gcodeLine.replace(';LAYER:', ''), 0);
            if (layerIndex !== scope.state.layer_index) {
                newLine();
                newLayer();
            }
            scope.state.layer_index = layerIndex;
            continue;
        } else if (gcodeLine.trim().indexOf(';Layer height:') === 0) {
            scope.layer_height = parseFloat(gcodeLine.replace(';Layer height:', ''));
            console.log('layer_height  ' + scope.layer_height);
            continue;
        }

        // 2. ignore comments
        if (gcodeLine.indexOf(';') !== -1) {
            gcodeLine = gcodeLine.split(';')[0];
        }

        // 3. ignore empty string
        if (gcodeLine.trim().length === 0) {
            continue;
        }
        var tokens = gcodeLine.split(' ');  // G1,F1080,X91.083,Y66.177,E936.7791
        var cmd = tokens[0].toUpperCase();   // G0 or G1 or G92 or M107
        //Argumments
        var args = {};
        tokens.splice(1).forEach((token) => {
            if (token[0] !== undefined) {
                var key = token[0].toLowerCase();  // G/M
                var value = parseFloat(token.substring(1));
                args[key] = value;  // {"f":990,"x":39.106,"y":73.464,"e":556.07107}
            }
        });
        //Process commands
        if (cmd === 'G28') {
            //G28: http://marlinfw.org/docs/gcode/G028.html
            // (x=0 && y=0 && z=0) is mark of start render
            scope.state.x = 0;
            scope.state.y = 0;
            scope.state.z = 0;

            startRender = true;
            console.log('startRender ...');

            //todo : 2 cases
            //case-1 : G28
            //case-2 : G28 X0
        } else if (cmd === 'G0' || cmd === 'G1') {
            if (startRender) {
                continue;
            }
            scope.state.x = (args.x || scope.state.x);
            scope.state.y = (args.y || scope.state.y);
            scope.state.z = (args.z || scope.state.z);
            verticeBuffer.push(new THREE.Vector3(scope.state.x, scope.state.y, scope.state.z));
        } else if (cmd === 'G2' || cmd === 'G3') {
            //G2/G3 - Arc Movement ( G2 clock wise and G3 counter clock wise )
            console.warn('THREE.Print3dGcodeLoader: Arc command not supported');
        } else if (cmd === 'G90') {
            //G90: Set to Absolute Positioning
        } else if (cmd === 'G91') {
            //G91: Set to state.relative Positioning
        } else if (cmd === 'G92') {
            //G92: Set Position
        } else {
            // console.warn( 'THREE.Print3dGcodeLoader: Command not supported:' + cmd );
        }
    }
    //process buffer
    newLine();
    newLayer();
    console.log('layer count:' + scope.layerCount);
    object.rotation.set(-Math.PI / 2, 0, 0);
    return object;
};

export default THREE.Print3dGcodeLoader;
