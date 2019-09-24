import * as THREE from 'three';
import each from 'lodash/each';
import colornames from 'colornames';

import { RED, GREEN } from '../../../constants/colors';
import TextSprite from '../../../components/three-extensions/TextSprite';
import TargetPoint from '../../../components/three-extensions/TargetPoint';

import GridLine from './GridLine';
import CoordinateAxes from './CoordinateAxes';

// const METRIC_GRID_SPACING = 30; // 10 mm

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
        // const gridSpacing = METRIC_GRID_SPACING;
        // const axisXLength = Math.ceil(this.size.x / gridSpacing) * gridSpacing;
        // const axisYLength = Math.ceil(this.size.y / gridSpacing) * gridSpacing;
        const gridSpacingX = 50;
        const gridSpacingY = 50;
        const offsetX = Math.max(this.size.x - gridSpacingX * 6, 0);
        const axisXLength = Math.ceil((this.size.x - offsetX) / gridSpacingX) * gridSpacingX;
        const axisYLength = Math.ceil(this.size.y / gridSpacingY) * gridSpacingY;

        const group = new THREE.Group();

        { // Coordinate Grid
            const gridLine = new GridLine(
                offsetX,
                axisXLength,
                gridSpacingX,
                axisYLength,
                gridSpacingY,
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

        { // Coordinate Axes
            const coordinateAxes = new CoordinateAxes(offsetX, axisXLength, axisYLength);
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
            /*
            const axisXLabel = new TextSprite({
                x: axisXLength + 10,
                y: 0,
                z: 0,
                size: 20,
                text: 'x',
                color: RED
            });
            const axisYLabel = new TextSprite({
                x: 0,
                y: axisYLength + 10,
                z: 0,
                size: 20,
                text: 'y',
                color: GREEN
            });

            group.add(axisXLabel);
            group.add(axisYLabel);
            */

            // const textSize = (10 / 3);
            const textSize = 20;
            // for (let x = -axisXLength; x <= axisXLength; x += gridSpacing) {
            for (let x = offsetX; x <= offsetX + axisXLength; x += gridSpacingX) {
                if (x !== 0) {
                    const textLabel = new TextSprite({
                        x: x,
                        // x: x + offsetX,
                        y: -textSize * 0.5,
                        z: 0,
                        size: textSize,
                        // text: x / 10,
                        text: x,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: RED,
                        opacity: 1.0
                    });
                    group.add(textLabel);
                }
            }
            // for (let y = -axisYLength; y <= axisYLength; y += gridSpacing) {
            for (let y = 0; y <= axisYLength; y += gridSpacingY) {
                if (y !== 0) {
                    const textLabel = new TextSprite({
                        x: -textSize + offsetX,
                        y: y,
                        z: 0,
                        size: textSize,
                        text: y,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: GREEN,
                        opacity: 1.0
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
