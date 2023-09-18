import { v4 as uuid } from 'uuid';
import { Vector2 } from 'three';

import { isEqual } from '../../shared/lib/utils';
import { EPSILON } from '../constants';
import {
    Materials,
    Origin,
    OriginType,
    RectangleWorkpieceReference,
} from '../constants/coordinate';
import { createSVGElement } from '../ui/SVGEditor/element-utils';

interface Workpiece2dOptions {
    size: Vector2;
    coordinateMode;
    coordinateSize?;
    materials: Materials;
    scale: number;
    getRoot: () => Element;
}

/**
 * Workpiece in 2D.
 *
 * Use rectangle to represent workpiece.
 */
class Workpiece2d {
    private id: string;
    private printableAreaGroup: Element;

    private size: {
        x: number;
        y: number;
    };

    private materials: Materials;
    private origin: Origin;
    private coordinateMode;
    private coordinateSize;
    private coorDelta: { x: number; y: number } = { x: 0, y: 0 };
    private scale: number = 1;

    public constructor(options: Workpiece2dOptions) {
        this.id = uuid();
        this.size = {
            ...options.size
        };
        this.materials = {
            ...options.materials
        };

        this.coorDelta = {
            x: 0,
            y: 0
        };
        this.coordinateMode = options.coordinateMode;
        this.coordinateSize = (options.coordinateSize && options.coordinateSize.x > 0) ? options.coordinateSize : this.size;
        this.origin = {
            type: OriginType.Workpiece,
            reference: RectangleWorkpieceReference.Center,
            referenceMetadata: {},
        };
        this._setCoordinateMode(this.coordinateMode);

        this.scale = options.scale;
        this.printableAreaGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'printable-area-group'
            }
        });

        options.getRoot().append(this.printableAreaGroup);
        this._setCoordinateAxes();
        this._setGridLine();
        this._setMaterialsRect();
        this._setOriginPoint();
    }

    public updateScale(state) {
        const { size, materials, scale, origin } = state;


        if (Math.abs(this.scale - scale) > EPSILON) {
            const drawAxis = !(this.origin && this.origin.type === OriginType.Object);

            this.scale = scale;
            for (const child of this.printableAreaGroup.childNodes) {
                if (child.getAttribute('stroke-width') !== '0') {
                    let realStrokeWidth = 1 / scale;

                    if (drawAxis && (child.getAttribute('virtualX') === '0' || child.getAttribute('virtualY') === '0')) {
                        realStrokeWidth = 4 / scale;
                    }

                    child.setAttribute('stroke-width', realStrokeWidth);
                }
            }
        }

        // Check size change or material change => re-draw workpiece
        const sizeChange = size && (!isEqual(this.size.x, size.x) || !isEqual(this.size.y, size.y));
        const materialsChange = materials && (
            !isEqual(this.materials.x, materials.x)
            || !isEqual(this.materials.y, materials.y)
            || !isEqual(this.origin.type, origin.type)
            || (this.origin.reference !== origin.reference)
        );

        if (sizeChange || materialsChange) {
            this.size = {
                ...size
            };
            this.materials = {
                ...materials
            };

            this.origin = Object.assign({}, origin);

            // Re-create coordinate sytem
            while (this.printableAreaGroup.firstChild) {
                this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
            }
            this._setCoordinateAxes();
            this._setGridLine();
            this._setMaterialsRect();
            this._setOriginPoint();
        }
    }

    public updateCoordinateMode(origin, coordinateMode, coordinateSize) {
        while (this.printableAreaGroup.firstChild) {
            this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
        }

        this.origin = origin;

        this.coordinateSize = coordinateSize;
        this._setCoordinateMode(coordinateMode);
        this._setCoordinateAxes();
        this._setGridLine();
        this._setMaterialsRect();
        this._setOriginPoint();
    }

    public _removeAll() {
        // do nothing
    }

    public _setCoordinateMode(coordinateMode) {
        this.coordinateMode = coordinateMode;
        this.coorDelta = {
            x: 0,
            y: 0
        };
        this.coorDelta.x += this.coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
        this.coorDelta.y -= this.coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;
    }

    /**
     * Draw grid line, axes, scales.
     */
    public _setGridLine() {
        // draw axis and scale
        const drawAxis = !(this.origin && this.origin.type === OriginType.Object);
        const drawScale = drawAxis;

        const { x, y } = this.size;
        const { x: cx, y: cy } = this.coordinateSize;
        const xMin = x - cx / 2 + this.coorDelta.x;
        const xMax = x + cx / 2 + this.coorDelta.x;
        const yMin = y - cy / 2 + this.coorDelta.y;
        const yMax = y + cy / 2 + this.coorDelta.y;
        const colorSmallGrid = '#EEEFF0';
        const colorBigGrid = '#EEEFF0';
        const colorTextFill = '#85888C';
        const textSize = 4;
        const coordinateModeName = this.coordinateMode.value;

        // small grid 10x10
        for (let i = y; i > yMin; i -= 10) {
            const color = colorSmallGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: i,
                    x2: xMax,
                    y2: i,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    virtualY: i - y,
                    'stroke-width': (i === y && drawAxis) ? (4 / this.scale) : (1 / this.scale),
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);
        }
        for (let i = y + 10; i < yMax; i += 10) {
            const color = colorSmallGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: i,
                    x2: xMax,
                    y2: i,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    virtualY: i - y,
                    'stroke-width': ((i - y) === 0 && drawAxis) ? (4 / this.scale) : (1 / this.scale),
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);
        }
        for (let i = x; i > xMin; i -= 10) {
            const color = colorSmallGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i,
                    y1: yMin,
                    x2: i,
                    y2: yMax,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    virtualX: i - x,
                    'stroke-width': ((i - x) === 0 && drawAxis) ? (4 / this.scale) : (1 / this.scale),
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);
        }
        for (let i = x + 10; i < xMax; i += 10) {
            const color = colorSmallGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i,
                    y1: yMin,
                    x2: i,
                    y2: yMax,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    virtualX: i - x,
                    'stroke-width': ((i - x) === 0 && drawAxis) ? (4 / this.scale) : (1 / this.scale),
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);
        }

        // big grid 50x50 and text
        for (let i = y; i > yMin; i -= 50) {
            const color = colorBigGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: i,
                    x2: xMax,
                    y2: i,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);

            if (drawScale) {
                const label = createSVGElement({
                    element: 'text',
                    attr: {
                        x: x + (coordinateModeName.indexOf('right') !== -1 ? 6 : -6),
                        y: i + 1.2,
                        id: uuid(),
                        'font-size': textSize,
                        fill: colorTextFill,
                        'text-anchor': 'middle',
                        'xml:space': 'preserve',
                        'stroke-width': 1 / this.scale,
                        'fill-opacity': 1,
                        'stroke-opacity': 0
                    }
                });
                label.innerHTML = -(i - y);
                label.style.cursor = 'default';
                this.printableAreaGroup.append(label);
            }
        }
        for (let i = y + 50; i < yMax; i += 50) {
            const color = colorBigGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: i,
                    x2: xMax,
                    y2: i,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);

            if (drawScale) {
                const label = createSVGElement({
                    element: 'text',
                    attr: {
                        x: x + (coordinateModeName.indexOf('right') !== -1 ? 6 : -6),
                        y: i + 1.2,
                        id: uuid(),
                        'font-size': textSize,
                        fill: colorTextFill,
                        'text-anchor': 'middle',
                        'xml:space': 'preserve',
                        'stroke-width': 1 / this.scale,
                        'fill-opacity': 1,
                        'stroke-opacity': 0
                    }
                });
                label.innerHTML = -(i - y);
                label.style.cursor = 'default';
                this.printableAreaGroup.append(label);
            }
        }
        for (let i = x; i > xMin; i -= 50) {
            const color = colorBigGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i,
                    y1: yMin,
                    x2: i,
                    y2: yMax,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);

            if (drawScale) {
                const label = createSVGElement({
                    element: 'text',
                    attr: {
                        x: i,
                        y: y + (coordinateModeName.indexOf('top') !== -1 ? -3 : 6),
                        id: uuid(),
                        'font-size': textSize,
                        fill: colorTextFill,
                        'text-anchor': 'middle',
                        'xml:space': 'preserve',
                        'stroke-width': 1 / this.scale,
                        'fill-opacity': 1,
                        'stroke-opacity': 0
                    }
                });
                if (i - x !== 0) {
                    label.innerHTML = i - x;
                }
                this.printableAreaGroup.append(label);
            }
        }
        for (let i = x + 50; i < xMax; i += 50) {
            const color = colorBigGrid;
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i,
                    y1: yMin,
                    x2: i,
                    y2: yMax,
                    id: uuid(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line);

            if (drawScale) {
                const label = createSVGElement({
                    element: 'text',
                    attr: {
                        x: i,
                        y: y + (coordinateModeName.indexOf('top') !== -1 ? -3 : 6),
                        id: uuid(),
                        'font-size': textSize,
                        fill: colorTextFill,
                        'text-anchor': 'middle',
                        'xml:space': 'preserve',
                        'stroke-width': 1 / this.scale,
                        'fill-opacity': 1,
                        'stroke-opacity': 0
                    }
                });
                if (i - x !== 0) {
                    label.innerHTML = i - x;
                }
                this.printableAreaGroup.append(label);
            }
        }

        // 4 border lines
        if (drawScale) {
            const borderColor = '#B9BCBF';
            const line1 = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: yMin,
                    x2: xMin,
                    y2: yMax,
                    id: uuid(),
                    stroke: borderColor,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            const line2 = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMax,
                    y1: yMin,
                    x2: xMax,
                    y2: yMax,
                    id: uuid(),
                    stroke: borderColor,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            const line3 = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: yMin,
                    x2: xMax,
                    y2: yMin,
                    id: uuid(),
                    stroke: borderColor,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            const line4 = createSVGElement({
                element: 'line',
                attr: {
                    x1: xMin,
                    y1: yMax,
                    x2: xMax,
                    y2: yMax,
                    id: uuid(),
                    stroke: borderColor,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
            this.printableAreaGroup.append(line1);
            this.printableAreaGroup.append(line2);
            this.printableAreaGroup.append(line3);
            this.printableAreaGroup.append(line4);
        }
    }

    public _setBorder(x1, y1, x2, y2, color, dashed) {
        const line = createSVGElement({
            element: 'line',
            attr: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                id: uuid(),
                stroke: color,
                fill: 'none',
                'stroke-dasharray': dashed ? '1, 1' : '',
                'stroke-width': 1 / this.scale,
                opacity: 0.8
            }
        });
        this.printableAreaGroup.append(line);
    }

    public _axisLabel() {
        const label = createSVGElement({
            element: 'text',
            attr: {
                x: 30,
                y: 30,
                id: uuid(),
                'font-size': 24,
                fill: '#ff7f00',
                'text-anchor': 'middle',
                'xml:space': 'preserve',
                'stroke-width': 0,
                'fill-opacity': 1,
                'stroke-opacity': 0
            }
        });
        label.innerHTML = 123;
        this.printableAreaGroup.append(label);
    }

    public _setCoordinateAxes() {
        const { x, y } = this.size;
        const { x: cx, y: cy } = this.coordinateSize;
        const xMin = x - cx / 2 + this.coorDelta.x;
        const xMax = x + cx / 2 + this.coorDelta.x;
        const yMin = y - cy / 2 + this.coorDelta.y;
        const yMax = y + cy / 2 + this.coorDelta.y;
        const border = createSVGElement({
            element: 'rect',
            attr: {
                x: xMin,
                y: yMin,
                width: xMax - xMin,
                height: yMax - yMin,
                id: uuid(),
                stroke: '#B9BCBF',
                fill: '#FFFFFF',
                'stroke-width': 2 / this.scale,
                opacity: 1,
                'fill-opacity': 1
            }
        });
        this.printableAreaGroup.append(border);
        // this._setBorder(, yMin, xMax, yMin, '#B9BCBF', false);
        // this._setBorder(xMin, yMin, xMin, yMax, '#B9BCBF', false);
        // this._setBorder(xMin, yMax, xMax, yMax, '#B9BCBF', false);
        // this._setBorder(xMax, yMin, xMax, yMax, '#B9BCBF', false);
    }

    // _setLockingBlock() {
    //     if ()
    // }
    public _setOriginPoint() {
        if (this.materials.isRotate) {
            return;
        }
        if (this.origin && this.origin.type === OriginType.Object) {
            return;
        }

        const { x, y } = this.size;
        let originElement = null;
        // console.log('createOrigin, origin =', this.origin);

        if (this.origin.type === OriginType.CNCLockingBlock) {
            originElement = createSVGElement({
                element: 'image',
                attr: {
                    x: x - (2.5 * this.scale),
                    y: y - (6 * this.scale),
                    width: 10 * this.scale,
                    height: 10 * this.scale,
                    href: '/resources/images/cnc/locking-block-red.svg',
                    id: 'locking-block',
                    preserveAspectRatio: 'none'
                }
            });
        } else {
            originElement = createSVGElement({
                element: 'circle',
                attr: {
                    cx: x,
                    cy: y,
                    r: 2,
                    fill: '#FF5759',
                    stroke: '#FF5759',
                    'stroke-width': 1 / this.scale,
                    opacity: 1,
                    'fill-opacity': 1
                }
            });
        }
        this.printableAreaGroup.append(originElement);
    }

    public _setMaterialsRect() {
        const { isRotate, diameter, length, fixtureLength = 20 } = this.materials;
        let { x = 0, y = 0 } = this.materials;

        if (isRotate && !x && !y) {
            x = diameter * Math.PI;
            y = length;
        }

        if (!isRotate) {
            return;
        }
        if (!x || !y) {
            return;
        }

        const height = Math.min(fixtureLength, y);
        const width = height * 415 / 90;
        const posX = this.size.x - x / 2;
        const scaleX = x / width;

        // eslint-disable-next-line no-unused-vars
        const nonEditableArea = createSVGElement({
            element: 'image',
            attr: {
                x: posX,
                y: this.size.y - y,
                width: width, // real width = width * scale
                height: height,
                href: '/resources/images/cnc-laser/pic_4-axis_stop_bg.png',
                stroke: '#000',
                'stroke-width': 1 / this.scale,
                opacity: 1,
                'fill-opacity': 1,
                transform: `scale(${scaleX} 1) translate(${(posX - posX * scaleX) / scaleX} 0)`
            }
        });
        this.printableAreaGroup.append(nonEditableArea);
    }
}

export default Workpiece2d;
