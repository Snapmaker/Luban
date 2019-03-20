import colornames from 'colornames';
import Toolpath from 'gcode-toolpath';
import * as THREE from 'three';
import log from '../../lib/log';

const defaultColor = new THREE.Color(0x28a7e1);
const whiteColor = new THREE.Color(0xffffff);
const motionColor = {
    'G0': new THREE.Color(0xc8c8c8),
    'G1': new THREE.Color(0x000000),
    'G2': new THREE.Color(colornames('deepskyblue')),
    'G3': new THREE.Color(colornames('deepskyblue'))
};

class GCodeRenderer {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'GCodeRenderer';
        // Example
        // [
        //   {
        //     code: 'G1 X1',
        //     index: 0,
        //     vertexIndex: 2
        //   }
        // ]
        this.frames = []; // Example
        this.frameIndex = 0;
    }

    renderGcode(gcode, name, renderMethod) {
        const geometry = new THREE.Geometry();

        const toolpath = new Toolpath({
            // @param {object} modal The modal object.
            // @param {object} v1 A 3D vector of the start point.
            // @param {object} v2 A 3D vector of the end point.
            addLine: (modal, v1, v2) => {
                const { motion } = modal;
                const color = motionColor[motion] || defaultColor;
                // geometry.vertices.push(new THREE.Vector3(v1.x, v1.y, v1.z));
                // geometry.colors.push(color);
                geometry.vertices.push(new THREE.Vector3(v2.x, v2.y, v2.z));
                geometry.colors.push(color);
            },
            addArcCurve: (modal, v1, v2, v0) => {
                const { motion, plane } = modal;
                const isClockwise = (motion === 'G2');
                const radius = Math.sqrt(
                    ((v1.x - v0.x) ** 2) + ((v1.y - v0.y) ** 2)
                );
                let startAngle = Math.atan2(v1.y - v0.y, v1.x - v0.x);
                let endAngle = Math.atan2(v2.y - v0.y, v2.x - v0.x);

                // Draw full circle if startAngle and endAngle are both zero
                if (startAngle === endAngle) {
                    endAngle += (2 * Math.PI);
                }

                const arcCurve = new THREE.ArcCurve(
                    v0.x, // aX
                    v0.y, // aY
                    radius, // aRadius
                    startAngle, // aStartAngle
                    endAngle, // aEndAngle
                    isClockwise // isClockwise
                );
                const divisions = 30;
                const points = arcCurve.getPoints(divisions);
                const color = motionColor[motion] || defaultColor;

                for (let i = 0; i < points.length; ++i) {
                    const point = points[i];
                    const z = ((v2.z - v1.z) / points.length) * i + v1.z;

                    if (plane === 'G17') { // XY-plane
                        geometry.vertices.push(new THREE.Vector3(point.x, point.y, z));
                    } else if (plane === 'G18') { // ZX-plane
                        geometry.vertices.push(new THREE.Vector3(point.y, z, point.x));
                    } else if (plane === 'G19') { // YZ-plane
                        geometry.vertices.push(new THREE.Vector3(z, point.x, point.y));
                    }
                    geometry.colors.push(color);
                }
            }
        });

        const childIndex = this.group.children.length;
        toolpath.loadFromStringSync(gcode, (line) => {
            this.frames.push({
                data: line,
                index: childIndex,
                vertexIndex: geometry.vertices.length - 1 // remember current vertex index
            });
        });

        let gcodeObject;
        if (renderMethod === 'point') {
            gcodeObject = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    color: whiteColor,
                    size: 0.1,
                    vertexColors: THREE.VertexColors,
                    opacity: 0.9,
                    transparent: true
                })
            );
        } else {
            gcodeObject = new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                    color: whiteColor,
                    linewidth: 1,
                    vertexColors: THREE.VertexColors,
                    opacity: 1,
                    transparent: true
                })
            );
        }
        gcodeObject.name = name;
        gcodeObject.geometry.originalColors = geometry.colors.slice();

        log.debug({
            gcodeObject: gcodeObject,
            frames: this.frames,
            frameIndex: this.frameIndex
        });

        this.group.add(gcodeObject);
    }

    setFrameIndex(frameIndex) {
        if (this.frames.length === 0) {
            return;
        }

        frameIndex = Math.min(frameIndex, this.frames.length - 1);
        frameIndex = Math.max(frameIndex, 0);

        const f1 = this.frames[this.frameIndex];
        const f2 = this.frames[frameIndex];

        const v1 = f1.vertexIndex;
        const v2 = f2.vertexIndex;

        // Completed path is grayed out
        if (f1.index === f2.index) {
            const object = this.group.children[f1.index];
            for (let i = v1; i < v2; i++) {
                object.geometry.colors[i] = defaultColor;
            }
            object.geometry.colorsNeedUpdate = true;
        } else {
            const v1 = f1.vertexIndex;
            const v2 = f2.vertexIndex;

            for (let index = f1.index; index <= f2.index; index++) {
                const object = this.group.children[index];

                if (index === f1.index) {
                    for (let i = v1, l = object.geometry.colors.length; i < l; i++) {
                        object.geometry.colors[i] = defaultColor;
                    }
                } else if (index === f2.index) {
                    for (let i = 0; i <= v2; i++) {
                        object.geometry.colors[i] = defaultColor;
                    }
                } else {
                    for (let i = 0, l = object.geometry.colors.length; i < l; i++) {
                        object.geometry.colors[i] = defaultColor;
                    }
                }
                object.geometry.colorsNeedUpdate = true;
            }
        }

        this.frameIndex = frameIndex;
    }

    resetFrameIndex() {
        const frame = this.frames[this.frameIndex];
        for (let index = 0; index <= frame.index; index++) {
            const object = this.group.children[index];
            for (let i = 0, l = object.geometry.colors.length; i < l; i++) {
                object.geometry.colors[i] = object.geometry.originalColors[i];
            }
            object.geometry.colorsNeedUpdate = true;
        }
    }
}

export default GCodeRenderer;
