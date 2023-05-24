import { MeshBasicMaterial, Object3D, Group, Mesh, PlaneGeometry, DoubleSide } from 'three';
import each from 'lodash/each';
import colornames from 'colornames';

import { RED, GREEN } from '../../../../constants/colors';
import TextSprite from '../../../../scene/three-extensions/TextSprite';
import TargetPoint from '../../../../scene/three-extensions/TargetPoint';

import GridLine from './GridLine';
import CoordinateAxes from './CoordinateAxes';
import { COORDINATE_MODE_CENTER } from '../../../../constants';

const METRIC_GRID_SPACING = 10; // 10 mm


class PrintablePlate extends Object3D {
    constructor(size, materials, coordinateMode) {
        super();
        this.isPrintPlane = true;
        this.type = 'PrintPlane';
        this.targetPoint = null;
        // this.coordinateVisible = true;
        this.coordinateSystem = null;
        this.size = size;
        this.materials = {
            ...materials
        };

        this.coordinateMode = coordinateMode ?? COORDINATE_MODE_CENTER;
        this.coorDelta = {
            dx: 0,
            dy: 0
        };
        this.coorDelta.dx += this.size.x / 2 * this.coordinateMode.setting.sizeMultiplyFactor.x;
        this.coorDelta.dy += this.size.y / 2 * this.coordinateMode.setting.sizeMultiplyFactor.y;

        this._setup();
    }

    updateSize(series, size = this.size, materials = this.materials) {
        this.series = series;
        this.size = size;
        this.materials = materials;
        this.remove(...this.children);
        this._setup();
    }

    _setup() {
        // Metric
        const gridSpacing = METRIC_GRID_SPACING;

        const group = new Group();

        { // Coordinate Grid
            const gridLine = new GridLine(
                -this.size.x / 2 + this.coorDelta.dx,
                this.size.x / 2 + this.coorDelta.dx,
                gridSpacing,
                -this.size.y / 2 + this.coorDelta.dy,
                this.size.y / 2 + this.coorDelta.dy,
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
            const coordinateAxes = new CoordinateAxes(
                -this.size.x / 2 + this.coorDelta.dx,
                this.size.x / 2 + this.coorDelta.dx,
                -this.size.y / 2 + this.coorDelta.dy,
                this.size.y / 2 + this.coorDelta.dy
            );
            coordinateAxes.name = 'CoordinateAxes';
            group.add(coordinateAxes);
        }

        { // Axis Labels
            const textSize = (10 / 3);
            const minX = Math.ceil((-this.size.x / 2 + this.coorDelta.dx) / gridSpacing) * gridSpacing;
            const minY = Math.ceil((-this.size.y / 2 + this.coorDelta.dy) / gridSpacing) * gridSpacing;
            const maxX = Math.floor((this.size.x / 2 + this.coorDelta.dx) / gridSpacing) * gridSpacing;
            const maxY = Math.floor((this.size.y / 2 + this.coorDelta.dy) / gridSpacing) * gridSpacing;

            for (let x = minX; x <= maxX; x += gridSpacing) {
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
            for (let y = minY; y <= maxY; y += gridSpacing) {
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

        // this._setMaterialsRect();
    }

    _setMaterialsRect() {
        // eslint-disable-next-line no-unused-vars
        const { x = 0, y = 0, fixtureLength = 0 } = this.materials;

        if (!x && !y) {
            return;
        }

        const editableAreaGeometry = new PlaneGeometry(x, y, 1, 1);
        const editableAreaMesh = new Mesh(editableAreaGeometry, new MeshBasicMaterial({ color: '#fff', opacity: 0.5, side: DoubleSide }));
        editableAreaMesh.position.y = y / 2 + 0.1;

        const nonEditableAreaGeometry = new PlaneGeometry(x, Math.min(fixtureLength, y), 1, 1);
        const nonEditableAreaMesh = new Mesh(nonEditableAreaGeometry, new MeshBasicMaterial({ color: '#FFFBFB', opacity: 0.5, side: DoubleSide }));
        nonEditableAreaMesh.position.y = y + 0.1 - fixtureLength / 2;

        this.add(editableAreaMesh);
        this.add(nonEditableAreaMesh);
    }

    changeCoordinateVisibility(value) {
        // this.coordinateVisible = value;
        this.coordinateSystem && (this.coordinateSystem.visible = value);
    }
}

export default PrintablePlate;
