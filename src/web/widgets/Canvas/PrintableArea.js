import * as THREE from 'three';
import _ from 'lodash';
import colornames from 'colornames';
import GridLine from './GridLine';
import CoordinateAxes from './CoordinateAxes';
import TextSprite from './TextSprite';
import TargetPoint from './TargetPoint';

const METRIC_GRID_COUNT = 30; // 60 cm
const METRIC_GRID_SPACING = 10; // 10 mm
const METRIC_AXIS_LENGTH = METRIC_GRID_SPACING * 30; // 300 mm

class PrintableArea extends THREE.Object3D {
    constructor(mode = '3dp') {
        super();
        this.isPrintableArea = true;
        this.type = 'PrintableArea';
        this.mode = mode;
        this.targetPoint = null;
        if (mode.toLowerCase() === '3dp') {
            this._initAs3dp();
        } else if (['laser', 'cnc', 'workspace'].includes(mode.toLowerCase())) {
            this._initAsOthers();
        }
    }

    _initAs3dp() {
        // add 6 sides(GridHelper) of print space
        const size = 125;
        const divisions = 1;

        const bottom = new THREE.GridHelper(size, divisions * 10);
        bottom.position.set(0, -size / 2, 0);
        bottom.material.opacity = 0.25;
        bottom.material.transparent = true;
        this.add(bottom);

        const top = new THREE.GridHelper(size, divisions);
        top.position.set(0, size / 2, 0);
        this.add(top);

        const left = new THREE.GridHelper(size, divisions);
        left.rotateZ(Math.PI / 2);
        left.position.set(-size / 2, 0, 0);
        this.add(left);

        const right = new THREE.GridHelper(size, divisions);
        right.rotateZ(Math.PI / 2);
        right.position.set(size / 2, 0, 0);
        this.add(right);

        const front = new THREE.GridHelper(size, divisions);
        front.rotateX(Math.PI / 2);
        front.position.set(0, 0, size / 2);
        this.add(front);

        const back = new THREE.GridHelper(size, divisions);
        back.rotateX(Math.PI / 2);
        back.position.set(0, 0, -size / 2);
        this.add(back);

        for (let k = 0; k < this.children.length; k += 1) {
            if (this.children[k] instanceof THREE.GridHelper) {
                this.children[k].material.opacity = 0.25;
                this.children[k].material.transparent = true;
            }
        }
        // const axis = new THREE.AxesHelper(50);
        // axis.position.set(0, 0, 0);
        // this.add(axis);

        // add logo
        const geometry = new THREE.PlaneGeometry(73.5, 16);
        const texture = new THREE.TextureLoader().load('./images/snapmaker-logo-512x128.png');
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.set(0, -size / 2, size / 4);
        this.add(mesh);
    }

    _initAsOthers() {
        { // Metric
            const metricCoordinateSystem = this.createCoordinateSystem({
                axisLength: METRIC_AXIS_LENGTH,
                gridCount: METRIC_GRID_COUNT,
                gridSpacing: METRIC_GRID_SPACING
            });
            metricCoordinateSystem.name = 'MetricCoordinateSystem';
            this.add(metricCoordinateSystem);
        }

        { // Target Point
            this.targetPoint = new TargetPoint({
                color: colornames('indianred'),
                radius: 0.5
            });
            this.targetPoint.name = 'TargetPoint';
            this.targetPoint.visible = true;
            this.add(this.targetPoint);
        }
    }

    createCoordinateSystem(options) {
        const {
            axisLength = METRIC_AXIS_LENGTH,
            gridCount = METRIC_GRID_COUNT,
            gridSpacing = METRIC_GRID_SPACING
        } = { ...options };

        const group = new THREE.Group();

        { // Coordinate Grid
            const gridLine = new GridLine(
                gridCount * gridSpacing,
                gridSpacing,
                gridCount * gridSpacing,
                gridSpacing,
                colornames('blue'), // center line
                colornames('gray 44') // grid
            );
            _.each(gridLine.children, (o) => {
                o.material.opacity = 0.15;
                o.material.transparent = true;
                o.material.depthWrite = false;
            });
            gridLine.name = 'GridLine';
            group.add(gridLine);
        }

        { // Coordinate Axes
            const coordinateAxes = new CoordinateAxes(axisLength);
            coordinateAxes.name = 'CoordinateAxes';
            group.add(coordinateAxes);
        }

        { // Axis Labels
            const axisXLabel = new TextSprite({
                x: axisLength + 10,
                y: 0,
                z: 0,
                size: 14,
                text: 'X',
                color: colornames('red')
            });
            const axisYLabel = new TextSprite({
                x: 0,
                y: axisLength + 10,
                z: 0,
                size: 14,
                text: 'Y',
                color: colornames('green')
            });

            group.add(axisXLabel);
            group.add(axisYLabel);

            const textSize = (10 / 3);
            for (let i = -gridCount; i <= gridCount; ++i) {
                if (i !== 0) {
                    const textLabel = new TextSprite({
                        x: i * gridSpacing,
                        y: -4,
                        z: 0,
                        size: textSize,
                        text: i * 10,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: colornames('red'),
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
            for (let i = -gridCount; i <= gridCount; ++i) {
                if (i !== 0) {
                    const textLabel = new TextSprite({
                        x: -4,
                        y: i * gridSpacing,
                        z: 0,
                        size: textSize,
                        text: i * 10,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: colornames('green'),
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
        }

        return group;
    }

    changeCoordinateVisibility(value) {
        this.getObjectByName('MetricCoordinateSystem') && (this.getObjectByName('MetricCoordinateSystem').visible = value);
    }
}

export default PrintableArea;
