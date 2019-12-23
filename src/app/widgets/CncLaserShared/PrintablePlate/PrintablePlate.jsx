import * as THREE from 'three';
import each from 'lodash/each';
import colornames from 'colornames';

import { RED, GREEN } from '../../../constants/colors';
import TextSprite from '../../../components/three-extensions/TextSprite';
import TargetPoint from '../../../components/three-extensions/TargetPoint';

import GridLine from './GridLine';
import CoordinateAxes from './CoordinateAxes';

const METRIC_GRID_SPACING = 10; // 10 mm

class PrintablePlate extends THREE.Object3D {
    constructor(size) {
        super();
        this.isPrintPlane = true;
        this.type = 'PrintPlane';
        this.targetPoint = null;
        // this.coordinateVisible = true;
        this.coordinateSystem = null;
        this.size = size;
        this._setup();
    }

    updateSize(size) {
        this.size = size;
        this.remove(...this.children);
        this._setup();
    }

    _setup() {
        // Metric
        const gridSpacing = METRIC_GRID_SPACING;
        const axisXLength = Math.ceil(this.size.x / gridSpacing) * gridSpacing;
        const axisYLength = Math.ceil(this.size.y / gridSpacing) * gridSpacing;

        const group = new THREE.Group();

        { // Coordinate Grid
            const gridLine = new GridLine(
                axisXLength,
                gridSpacing,
                axisYLength,
                gridSpacing,
                colornames('blue'), // center line
                colornames('gray 44') // grid
            );
            each(gridLine.children, (o) => {
                o.material.opacity = 0.15;
                o.material.transparent = true;
                o.material.depthWrite = false;
            });
            gridLine.name = 'GridLine';
            group.add(gridLine);
        }

        { // Coordinate Control
            const coordinateAxes = new CoordinateAxes(axisXLength, axisYLength);
            coordinateAxes.name = 'CoordinateAxes';
            group.add(coordinateAxes);

            const arrowX = new THREE.Mesh(
                new THREE.CylinderBufferGeometry(0, 1, 4),
                new THREE.MeshBasicMaterial({ color: RED })
            );
            arrowX.position.set(axisXLength + 2, 0, 0);
            arrowX.rotation.set(0, 0, -Math.PI / 2);
            group.add(arrowX);

            const arrowY = new THREE.Mesh(
                new THREE.CylinderBufferGeometry(0, 1, 4),
                new THREE.MeshBasicMaterial({ color: GREEN })
            );
            arrowY.position.set(0, axisYLength + 2, 0);
            group.add(arrowY);
        }

        { // Axis Labels
            const axisXLabel = new TextSprite({
                x: axisXLength + 10,
                y: 0,
                z: 0,
                size: 10,
                text: 'X',
                color: RED
            });
            const axisYLabel = new TextSprite({
                x: 0,
                y: axisYLength + 10,
                z: 0,
                size: 10,
                text: 'Y',
                color: GREEN
            });

            group.add(axisXLabel);
            group.add(axisYLabel);

            const textSize = (10 / 3);
            for (let x = -axisXLength; x <= axisXLength; x += gridSpacing) {
                if (x !== 0) {
                    const textLabel = new TextSprite({
                        x: x,
                        y: -4,
                        z: 0,
                        size: textSize,
                        text: x,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: RED,
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
            for (let y = -axisYLength; y <= axisYLength; y += gridSpacing) {
                if (y !== 0) {
                    const textLabel = new TextSprite({
                        x: -4,
                        y: y,
                        z: 0,
                        size: textSize,
                        text: y,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: GREEN,
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
        }
        this.coordinateSystem = group;
        group.name = 'MetricCoordinateSystem';
        this.add(group);

        // Target Point
        this.targetPoint = new TargetPoint({
            color: colornames('indianred'),
            radius: 0.5
        });
        this.targetPoint.name = 'TargetPoint';
        this.targetPoint.visible = true;
        this.add(this.targetPoint);
    }

    changeCoordinateVisibility(value) {
        // this.coordinateVisible = value;
        this.coordinateSystem && (this.coordinateSystem.visible = value);
    }
}

export default PrintablePlate;
