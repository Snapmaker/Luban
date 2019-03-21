import colornames from 'colornames';
import * as THREE from 'three';

const buildAxis = (src, dst, color, dashed) => {
    let geometry = new THREE.Geometry();
    let material;

    if (dashed) {
        material = new THREE.LineDashedMaterial({
            linewidth: 1,
            color: color,
            dashSize: 1,
            gapSize: 1,
            opacity: 0.8,
            transparent: true
        });
    } else {
        material = new THREE.LineBasicMaterial({
            linewidth: 1,
            color: color,
            opacity: 0.8,
            transparent: true
        });
    }

    geometry.vertices.push(src.clone());
    geometry.vertices.push(dst.clone());

    const axisLine = new THREE.Line(geometry, material);

    if (dashed) {
        // three.js r91 abandon API of 'geometry.computeLineDistances()', replaced by 'line.computeLineDistances()'
        // Computes an array of distance values which are necessary for LineDashedMaterial.
        axisLine.computeLineDistances();
    }

    return axisLine;
};

// CoordinateAxes
// An axis object to visualize the the 3 axes in a simple way.
// The X axis is red. The Y axis is green. The Z axis is blue.
class CoordinateAxes {
    group = new THREE.Object3D();

    // Creates an axisHelper with lines of length size.
    // @param {number} size Define the size of the line representing the axes.
    // @see [Drawing the Coordinate Axes]{@http://soledadpenades.com/articles/three-js-tutorials/drawing-the-coordinate-axes/}
    constructor(width, height) {
        const red = colornames('red');
        const green = colornames('green');

        this.group.add(
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(width, 0, 0), red, false), // +X
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-width, 0, 0), red, true), // -X
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0), green, false), // +Y
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -height, 0), green, true), // -Y
        );

        return this.group;
    }
}

export default CoordinateAxes;
