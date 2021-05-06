import uuid from 'uuid';
import { createSVGElement } from './element-utils';
import {
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_BOTTOM_RIGHT,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT,
    EPSILON
} from '../../constants';
import { isEqual } from '../../../shared/lib/utils';

class PrintableArea {
    constructor(svgFactory) {
        this.id = uuid.v4();
        this.svgFactory = svgFactory;
        this.size = {
            ...svgFactory.size
        };
        this.materials = {
            ...svgFactory.materials
        };

        this.coorDelta = {
            x: 0,
            y: 0
        };
        this.coordinateMode = svgFactory.coordinateMode;
        this._setCoordinateMode(this.coordinateMode);

        this.scale = svgFactory.scale;
        this.printableAreaGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'printable-area-group'
            }
        });

        this.svgFactory.getRoot().append(this.printableAreaGroup);
        this._setGridLine();
        this._setCoordinateAxes();
        this._setMaterialsRect();
    }

    updateScale(state) {
        const { size, materials, scale } = state;
        if (Math.abs(this.scale - scale) > EPSILON) {
            this.scale = scale;
            for (const child of this.printableAreaGroup.childNodes) {
                if (child.getAttribute('stroke-width') !== '0') {
                    child.setAttribute('stroke-width', 1 / scale);
                }
            }
        }
        const sizeChange = size && (!isEqual(this.size.x, size.x) || !isEqual(this.size.y, size.y));
        const materialsChange = materials && (!isEqual(this.materials.x, materials.x) || !isEqual(this.materials.y, materials.y));
        if (sizeChange || materialsChange) {
            this.size = {
                ...size
            };
            this.materials = {
                ...materials
            };
            while (this.printableAreaGroup.firstChild) {
                this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
            }
            this._setGridLine();
            this._setCoordinateAxes();
            this._setMaterialsRect();
        }
    }

    updateCoordinateMode(coordinateMode) {
        console.log('coordinateMode', coordinateMode);
        while (this.printableAreaGroup.firstChild) {
            this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
        }
        this._setCoordinateMode(coordinateMode);
        this._setGridLine();
        this._setCoordinateAxes();
        this._setMaterialsRect();
    }

    _removeAll() {

    }

    _setCoordinateMode(coordinateMode) {
        this.coordinateMode = coordinateMode;
        if (coordinateMode === COORDINATE_MODE_CENTER) {
            this.coorDelta = {
                x: 0,
                y: 0
            };
        }
        if (coordinateMode === COORDINATE_MODE_TOP_RIGHT) {
            this.coorDelta = {
                x: this.size.x / 2,
                y: -this.size.y / 2
            };
        }
        if (coordinateMode === COORDINATE_MODE_TOP_LEFT) {
            this.coorDelta = {
                x: -this.size.x / 2,
                y: -this.size.y / 2
            };
        }
        if (coordinateMode === COORDINATE_MODE_BOTTOM_RIGHT) {
            this.coorDelta = {
                x: this.size.x / 2,
                y: this.size.y / 2
            };
        }
        if (coordinateMode === COORDINATE_MODE_BOTTOM_LEFT) {
            this.coorDelta = {
                x: -this.size.x / 2,
                y: +this.size.y / 2
            };
        }
    }

    _setGridLine() {
        const { x, y } = this.size;
        const minY = Math.floor((y / 2 + this.coorDelta.y) / 10);
        const maxY = Math.floor((y * 3 / 2 + this.coorDelta.y) / 10);
        for (let i = minY; i <= maxY; i++) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: x / 2 + this.coorDelta.x,
                    y1: i * 10,
                    x2: x * 3 / 2 + this.coorDelta.x,
                    y2: i * 10,
                    id: uuid.v4(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 0.16
                }
            });
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: x - 4,
                    y: i * 10 + 0.2,
                    id: uuid.v4(),
                    'font-size': 4,
                    'font-family': 'serif',
                    fill: 'green',
                    'text-anchor': 'middle',
                    'xml:space': 'preserve',
                    'stroke-width': 1 / this.scale,
                    'fill-opacity': 0.5,
                    'stroke-opacity': 0
                }
            });
            if (-(i * 10 - y) !== 0) {
                label.innerHTML = -(i * 10 - y);
                label.style.cursor = 'default';
            }
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
        }
        const minX = Math.floor((x / 2 + this.coorDelta.x) / 10);
        const maxX = Math.floor((x * 3 / 2 + this.coorDelta.x) / 10);
        for (let i = minX; i <= maxX; i++) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i * 10,
                    y1: y / 2 + this.coorDelta.y,
                    x2: i * 10,
                    y2: y * 3 / 2 + this.coorDelta.y,
                    id: uuid.v4(),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': 1 / this.scale,
                    opacity: 0.16
                }
            });
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: i * 10,
                    y: y + 5,
                    id: uuid.v4(),
                    'font-size': 4,
                    'font-family': 'serif',
                    fill: 'red',
                    'text-anchor': 'middle',
                    'xml:space': 'preserve',
                    'stroke-width': 1 / this.scale,
                    'fill-opacity': 0.5,
                    'stroke-opacity': 0
                }
            });
            if (i * 10 - x !== 0) {
                label.innerHTML = i * 10 - x;
            }
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
        }
    }

    _setAxes(x1, y1, x2, y2, color, dashed) {
        const line = createSVGElement({
            element: 'line',
            attr: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                id: uuid.v4(),
                stroke: color,
                fill: 'none',
                'stroke-dasharray': dashed ? '1, 1' : '',
                'stroke-width': 1 / this.scale,
                opacity: 0.8
            }
        });
        this.printableAreaGroup.append(line);
    }

    _axisLabel() {
        const label = createSVGElement({
            element: 'text',
            attr: {
                x: 30,
                y: 30,
                id: uuid.v4(),
                'font-size': 24,
                'font-family': 'serif',
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

    _setCoordinateAxes() {
        const { x, y } = this.size;
        if (x / 2 + this.coorDelta.x < x) {
            this._setAxes(x / 2 + this.coorDelta.x, y, x, y, 'red', true);
        }
        if (y / 2 + this.coorDelta.y < y) {
            this._setAxes(x, y / 2 + this.coorDelta.y, x, y, 'green', false);
        }
        if (x * 3 / 2 + this.coorDelta.x > x) {
            this._setAxes(x * 3 / 2 + this.coorDelta.x, y, x, y, 'red', false);
        }
        if (y * 3 / 2 + this.coorDelta.y > y) {
            this._setAxes(x, y * 3 / 2 + this.coorDelta.y, x, y, 'green', true);
        }

        const origin = createSVGElement({
            element: 'circle',
            attr: {
                cx: x,
                cy: y,
                r: 0.5,
                fill: 'indianred',
                stroke: 'indianred',
                'stroke-width': 1 / this.scale,
                opacity: 1
            }
        });
        this.printableAreaGroup.append(origin);
    }

    _setMaterialsRect() {
        const { x = 0, y = 0, fixtureLength = 0 } = this.materials;
        if (!x || !y) {
            return;
        }
        const editableArea = createSVGElement({
            element: 'rect',
            attr: {
                x: this.size.x - x / 2,
                y: this.size.y - y - 0.1,
                width: x,
                height: y,
                fill: '#FFFFFF',
                stroke: '#000',
                'stroke-width': 1 / this.scale,
                opacity: 1
            }
        });
        // eslint-disable-next-line no-unused-vars
        const nonEditableArea = createSVGElement({
            element: 'rect',
            attr: {
                x: this.size.x - x / 2,
                y: this.size.y - y,
                width: x,
                height: Math.min(fixtureLength, y),
                fill: '#FFE7E7',
                stroke: '#000',
                'stroke-width': 1 / this.scale,
                opacity: 1
            }
        });
        this.printableAreaGroup.append(editableArea);
        this.printableAreaGroup.append(nonEditableArea);
    }
}

export default PrintableArea;
