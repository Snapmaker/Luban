import uuid from 'uuid';
import { createSVGElement } from './element-utils';
import { EPSILON } from '../../constants';
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

    _setGridLine() {
        const { x, y } = this.size;
        const yi = Math.floor(y / 10);
        for (let i = -yi; i <= yi; i++) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: 0,
                    y1: i * 10 + y,
                    x2: 2 * x,
                    y2: i * 10 + y,
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
                    y: i * 10 + y + 1.2,
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
            if (i !== 0) {
                label.innerHTML = -i * 10;
                label.style.cursor = 'default';
            }
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
        }
        const xi = Math.floor(x / 10);
        for (let i = -xi; i <= xi; i++) {
            const color = i === 0 ? '#444444' : '#888888';
            const line = createSVGElement({
                element: 'line',
                attr: {
                    x1: i * 10 + x,
                    y1: 0,
                    x2: i * 10 + x,
                    y2: 2 * y,
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
                    x: i * 10 + x,
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
            if (i !== 0) {
                label.innerHTML = i * 10;
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
        this._setAxes(0, y, x, y, 'red', true);
        this._setAxes(x, 0, x, y, 'green', false);
        this._setAxes(2 * x, y, x, y, 'red', false);
        this._setAxes(x, 2 * y, x, y, 'green', true);

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
