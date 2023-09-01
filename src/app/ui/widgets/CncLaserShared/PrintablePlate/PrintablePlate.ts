import each from 'lodash/each';
import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    ShapeGeometry,
    Math as ThreeMath
} from 'three';

import TargetPoint from '../../../../scene/three-extensions/TargetPoint';
import TextSprite from '../../../../scene/three-extensions/TextSprite';
import { COORDINATE_MODE_CENTER, DEFAULT_LUBAN_HOST } from '../../../../constants';
import { Origin, OriginType, RectangleWorkpieceReference, Workpiece, WorkpieceShape } from '../../../../constants/coordinate';
import SVGLoader from '../../../../scene/three-extensions/SVGLoader';
import GridLine from './GridLine';

const METRIC_GRID_SPACING = 10; // 10 mm
const METRIC_GRID_BIG_SPACING = 50;


class PrintablePlate extends Object3D {
    private coordinateSystem: Group = null;

    private workpiece: Workpiece;
    private size: { x: number; y: number };
    // private materials: Materials;
    private origin: Origin;
    private coordinateMode;
    private coorDelta: { dx: number; dy: number };

    private targetPoint = null;

    public constructor(size, workpiece: Workpiece, origin, coordinateMode) {
        super();

        this.type = 'PrintPlane';

        this.targetPoint = null;
        // this.coordinateVisible = true;
        this.coordinateSystem = null;
        this.workpiece = workpiece;
        this.size = size;
        this.origin = origin || {
            type: OriginType.Workpiece,
            reference: RectangleWorkpieceReference.Center,
            referenceMetadata: {},
        };

        // Move this function into _setup(), maybe?
        if (workpiece.shape === WorkpieceShape.Cylinder) {
            return;
        }

        this.coordinateMode = coordinateMode ?? COORDINATE_MODE_CENTER;
        this.coorDelta = {
            dx: 0,
            dy: 0
        };
        this.coorDelta.dx += this.size.x / 2 * this.coordinateMode.setting.sizeMultiplyFactor.x;
        this.coorDelta.dy += this.size.y / 2 * this.coordinateMode.setting.sizeMultiplyFactor.y;

        this._setup();
    }

    public updateSize(series, size = null, workpiece = null, origin: Origin = null) {
        console.log('PrintablePlate.updateSize()');
        if (size) {
            this.size = size;
        }

        if (workpiece) {
            this.workpiece = workpiece;
        }

        if (origin) {
            this.origin = origin;
        }

        this.remove(...this.children);
        this._setup();
    }

    public _setup() {
        // Metric
        const gridSpacing = METRIC_GRID_SPACING;

        const group = new Group();

        // { // Border Plane
        //     const plane = new PlaneGeometry(this.size.x, this.size.y);
        //     const material = new MeshBasicMaterial({
        //         side: DoubleSide,
        //         color: 0xFFFFFF
        //     });
        //     const borderPlane = new Mesh(plane, material);
        //     group.add(borderPlane);
        // }
        { // Coordinate Grid
            // Todo: cause twice
            const gridLine = new GridLine(
                -this.size.x / 2 + this.coorDelta?.dx,
                this.size.x / 2 + this.coorDelta?.dx,
                gridSpacing,
                -this.size.y / 2 + this.coorDelta?.dy,
                this.size.y / 2 + this.coorDelta?.dy,
                gridSpacing,
                0XFFFFFF - 0xF500F7 // grid
            );
            each(gridLine.children, (o) => {
                o.material.opacity = 0.15;
                o.material.transparent = true;
                o.material.depthWrite = false;
            });
            gridLine.name = 'GridLine';
            group.add(gridLine);
        }

        { // Axis Labels
            const textSize = (10 / 3);
            const minX = Math.ceil((-this.size.x / 2 + this.coorDelta?.dx) / METRIC_GRID_BIG_SPACING) * METRIC_GRID_BIG_SPACING;
            const minY = Math.ceil((-this.size.y / 2 + this.coorDelta?.dy) / METRIC_GRID_BIG_SPACING) * METRIC_GRID_BIG_SPACING;
            const maxX = Math.floor((this.size.x / 2 + this.coorDelta?.dx) / METRIC_GRID_BIG_SPACING) * METRIC_GRID_BIG_SPACING;
            const maxY = Math.floor((this.size.y / 2 + this.coorDelta?.dy) / METRIC_GRID_BIG_SPACING) * METRIC_GRID_BIG_SPACING;

            for (let x = minX; x <= maxX; x += METRIC_GRID_BIG_SPACING) {
                if (x !== 0) {
                    const textLabel = new TextSprite({
                        x: x,
                        y: -4,
                        z: 0,
                        size: textSize,
                        text: x,
                        textAlign: 'center',
                        textBaseline: 'bottom',
                        color: 0x85888c,
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
            for (let y = minY; y <= maxY; y += METRIC_GRID_BIG_SPACING) {
                const textLabel = new TextSprite({
                    x: -4,
                    y: y,
                    z: 0,
                    size: textSize,
                    text: y,
                    textAlign: 'center',
                    textBaseline: 'bottom',
                    color: 0x85888c,
                    opacity: 0.5
                });
                group.add(textLabel);
            }
        }
        this.coordinateSystem = group;
        group.name = 'MetricCoordinateSystem';
        this.add(group);

        // Target Point
        this.targetPoint = new TargetPoint({
            color: 0xFF5759,
            radius: 2
        });
        this.targetPoint.name = 'TargetPoint';
        this.targetPoint.visible = true;
        this.add(this.targetPoint);

        // Draw locking block if we have one
        if (this.origin.type === OriginType.CNCLockingBlock) {
            new SVGLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/cnc/locking-block-red.svg`, (data) => {
                const paths = data.paths;

                const svgGroup = new Group();

                for (let i = 0; i < paths.length; i++) {
                    const path = paths[i];

                    const material = new MeshBasicMaterial({
                        color: path.color,
                        side: DoubleSide,
                        depthWrite: false,
                    });

                    const pathShape = SVGLoader.createShapes(path);

                    for (let j = 0; j < pathShape.length; j++) {
                        const shape = pathShape[j];

                        const geometry = new ShapeGeometry(shape);
                        const mesh = new Mesh(geometry, material);
                        mesh.scale.set(0.7, 0.7, 0.7);
                        svgGroup.add(mesh);
                    }
                }
                svgGroup.position.set(10, -8.5, 0.01);
                svgGroup.rotateZ(ThreeMath.degToRad(90));
                this.add(svgGroup);
            });
        }
    }

    public changeCoordinateVisibility(value: boolean) {
        this.coordinateSystem && (this.coordinateSystem.visible = value);
    }
}

export default PrintablePlate;
