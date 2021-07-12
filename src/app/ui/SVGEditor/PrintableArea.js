import uuid from 'uuid';
import { createSVGElement } from './element-utils';
import {
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
        this.coordinateSize = (svgFactory.coordinateSize && svgFactory.coordinateSize.x > 0) ? svgFactory.coordinateSize : this.size;
        this._setCoordinateMode(this.coordinateMode, this.coordinateSize);

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

    updateCoordinateMode(coordinateMode, coordinateSize) {
        while (this.printableAreaGroup.firstChild) {
            this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
        }
        this.coordinateSize = coordinateSize;
        this._setCoordinateMode(coordinateMode);
        this._setGridLine();
        this._setCoordinateAxes();
        this._setMaterialsRect();
    }

    _removeAll() {

    }

    _setCoordinateMode(coordinateMode) {
        this.coordinateMode = coordinateMode;
        this.coorDelta = {
            x: 0,
            y: 0
        };
        this.coorDelta.x += this.coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
        this.coorDelta.y -= this.coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;
    }

    _setGridLine() {
        const { x, y } = this.size;
        const { x: cx, y: cy } = this.coordinateSize;
        const minY = Math.ceil((y - cy / 2 + this.coorDelta.y) / 10) * 10;
        const maxY = Math.floor((y + cy / 2 + this.coorDelta.y) / 10) * 10;
        for (let i = minY; i <= maxY; i += 10) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: x - cx / 2 + this.coorDelta.x,
                    y1: i,
                    x2: x + cx / 2 + this.coorDelta.x,
                    y2: i,
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
                    y: i + 1.2,
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
            if (i - y !== 0) {
                label.innerHTML = -(i - y);
                label.style.cursor = 'default';
            }
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
        }
        const minX = Math.ceil((x - cx / 2 + this.coorDelta.x) / 10) * 10;
        const maxX = Math.floor((x + cx / 2 + this.coorDelta.x) / 10) * 10;
        for (let i = minX; i <= maxX; i += 10) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i,
                    y1: y - cy / 2 + this.coorDelta.y,
                    x2: i,
                    y2: y + cy / 2 + this.coorDelta.y,
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
                    x: i,
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
            if (i - x !== 0) {
                label.innerHTML = i - x;
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
        const { x: cx, y: cy } = this.coordinateSize;
        if (x - cx / 2 + this.coorDelta.x < x) {
            this._setAxes(x - cx / 2 + this.coorDelta.x, y, x, y, 'red', true);
        }
        if (y - cy / 2 + this.coorDelta.y < y) {
            this._setAxes(x, y - cy / 2 + this.coorDelta.y, x, y, 'green', false);
        }
        if (x + cx / 2 + this.coorDelta.x > x) {
            this._setAxes(x + cx / 2 + this.coorDelta.x, y, x, y, 'red', false);
        }
        if (y + cy / 2 + this.coorDelta.y > y) {
            this._setAxes(x, y + cy / 2 + this.coorDelta.y, x, y, 'green', true);
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
                opacity: 1,
                'fill-opacity': 1
            }
        });
        this.printableAreaGroup.append(origin);
    }

    _setMaterialsRect() {
        const { x = 0, y = 0, fixtureLength = 0 } = this.materials;
        if (!x || !y) {
            return;
        }

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
                opacity: 1,
                'fill-opacity': 1
            }
        });
        this.printableAreaGroup.append(nonEditableArea);
    }
}

export default PrintableArea;
