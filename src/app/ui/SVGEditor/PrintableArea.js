import { v4 as uuid } from 'uuid';
import { createSVGElement } from './element-utils';
import {
    EPSILON
} from '../../constants';
import { isEqual } from '../../../shared/lib/utils';

class PrintableArea {
    constructor(svgFactory) {
        this.id = uuid();
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
        this._setCoordinateAxes();
        this._setGridLine();
        this._setMaterialsRect();
        this._setOriginPoint();
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
            this._setCoordinateAxes();
            this._setGridLine();
            this._setMaterialsRect();
            this._setOriginPoint();
        }
    }

    updateCoordinateMode(coordinateMode, coordinateSize) {
        while (this.printableAreaGroup.firstChild) {
            this.printableAreaGroup.removeChild(this.printableAreaGroup.lastChild);
        }
        this.coordinateSize = coordinateSize;
        this._setCoordinateMode(coordinateMode);
        this._setCoordinateAxes();
        this._setGridLine();
        this._setMaterialsRect();
        this._setOriginPoint();
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
                    'stroke-width': 1 / this.scale,
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
                    'stroke-width': 1 / this.scale,
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
                    'stroke-width': 1 / this.scale,
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
                    'stroke-width': 1 / this.scale,
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
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: x + (coordinateModeName.indexOf('right') !== -1 ? 6 : -6),
                    y: i + 1.2,
                    id: uuid(),
                    'font-size': textSize,
                    'font-family': 'roboto',
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
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
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
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: x + (coordinateModeName.indexOf('right') !== -1 ? 6 : -6),
                    y: i + 1.2,
                    id: uuid(),
                    'font-size': textSize,
                    'font-family': 'roboto',
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
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
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
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: i,
                    y: y + (coordinateModeName.indexOf('top') !== -1 ? -3 : 6),
                    id: uuid(),
                    'font-size': textSize,
                    'font-family': 'roboto',
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
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
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
            const label = createSVGElement({
                element: 'text',
                attr: {
                    x: i,
                    y: y + (coordinateModeName.indexOf('top') !== -1 ? -3 : 6),
                    id: uuid(),
                    'font-size': textSize,
                    'font-family': 'roboto',
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
            this.printableAreaGroup.append(line);
            this.printableAreaGroup.append(label);
        }

        // 4 border lines
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

    _setBorder(x1, y1, x2, y2, color, dashed) {
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

    _axisLabel() {
        const label = createSVGElement({
            element: 'text',
            attr: {
                x: 30,
                y: 30,
                id: uuid(),
                'font-size': 24,
                'font-family': 'roboto',
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

    _setOriginPoint() {
        if (this.materials.isRotate) {
            return;
        }
        const { x, y } = this.size;
        const origin = createSVGElement({
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
        this.printableAreaGroup.append(origin);
    }

    _setMaterialsRect() {
        const { isRotate, x = 0, y = 0, fixtureLength = 0 } = this.materials;
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

export default PrintableArea;
