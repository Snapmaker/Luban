import uuid from 'uuid';
import { createSVGElement } from './element-utils';
import { EPSILON } from '../../constants';

class PrintableArea {
    constructor(svgFactory) {
        this.id = uuid.v4();
        this.svgFactory = svgFactory;
        this.size = {
            ...svgFactory.size
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
    }

    updateScale(state) {
        const { size, scale } = state;
        if (Math.abs(this.scale - scale) > EPSILON) {
            this.scale = scale;
            for (const child of this.printableAreaGroup.childNodes) {
                child.setAttribute('stroke-width', 1 / scale);
            }
        }
        if (size && (Math.abs(this.size.x - size.x) > EPSILON
            || Math.abs(this.size.y - size.y) > EPSILON)) {
            this.size = {
                ...size
            };
            while (this.printableAreaGroup.firstChild) {
                this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
            }
            this._setGridLine();
            this._setCoordinateAxes();
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
}

export default PrintableArea;
