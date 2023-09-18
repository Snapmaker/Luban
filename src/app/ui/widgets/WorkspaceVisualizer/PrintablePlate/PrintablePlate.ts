import colornames from 'colornames';
import each from 'lodash/each';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';

import { COORDINATE_MODE_CENTER } from '../../../../constants';
import { GREEN, RED } from '../../../../constants/colors';
import TargetPoint from '../../../../scene/three-extensions/TargetPoint';
import TextSprite from '../../../../scene/three-extensions/TextSprite';
import CoordinateAxes from './CoordinateAxes';
import GridLine from './GridLine';
import { Materials } from '../../../../constants/coordinate';

const METRIC_GRID_SPACING = 10; // 10 mm


class PrintablePlate extends Object3D {
    private isPrintPlane: boolean = true;

    private coordinateSystem: Group = null;
    private size: { x: number; y: number };
    private materials: Materials;
    private coordinateMode;
    private coorDelta: { dx: number; dy: number };

    private targetPoint = null;

    public constructor(size, materials, coordinateMode) {
        super();

        this.type = 'PrintPlane';
        this.isPrintPlane = true;

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

    public updateSize(series, size = this.size, materials = this.materials) {
        // this.series = series;
        this.size = size;
        this.materials = materials;
        this.remove(...this.children);
        this._setup();
    }

    public _setup() {
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

    public _setMaterialsRect() {
        // eslint-disable-next-line no-unused-vars
        const { x = 0, y = 0, fixtureLength = 20 } = this.materials;

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

    public changeCoordinateVisibility(value) {
        // this.coordinateVisible = value;
        this.coordinateSystem && (this.coordinateSystem.visible = value);
    }
}

export default PrintablePlate;
