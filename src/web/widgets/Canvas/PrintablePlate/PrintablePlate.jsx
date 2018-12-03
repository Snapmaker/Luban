import * as THREE from 'three';
import _ from 'lodash';
import colornames from 'colornames';
import GridLine from './GridLine';
import CoordinateAxes from './CoordinateAxes';
import TextSprite from '../../../components/three-extensions/TextSprite';
import TargetPoint from '../../../components/three-extensions/TargetPoint';

const METRIC_GRID_COUNT = 20;
const METRIC_GRID_SPACING = 10; // 10 mm
const METRIC_AXIS_LENGTH = METRIC_GRID_SPACING * METRIC_GRID_COUNT;

class PrintablePlate extends THREE.Object3D {
    constructor() {
        super();
        this.isPrintPlane = true;
        this.type = 'PrintPlane';
        this.targetPoint = null;
        this.coordinateVisible = true;
        this._setup();
    }

    _setup() {
        { // Metric
            const metricCoordinateSystem = this._createCoordinateSystem({
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

    _createCoordinateSystem(options) {
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
        this.coordinateVisible = value;
        this.getObjectByName('MetricCoordinateSystem') && (this.getObjectByName('MetricCoordinateSystem').visible = value);
    }
}

export default PrintablePlate;
