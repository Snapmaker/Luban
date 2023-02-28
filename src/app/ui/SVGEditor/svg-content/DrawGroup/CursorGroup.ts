import { createSVGElement } from '../../element-utils';
import { MODE, ATTACH_POINT_RADIUS, POINT_RADIUS, POINT_SIZE, POINT_WEIGHT, THEME_COLOR } from './constants';
import { TCoordinate } from './types';

const cursorWidth = 100;

class CursorGroup {
    public mode: MODE;

    public group: SVGGElement;

    private cursor: SVGSVGElement;

    private cursorPoint: SVGRectElement;

    private attachPoint: SVGCircleElement;

    private attachTip: SVGGElement;

    private cursorCoordinate: TCoordinate = [0, 0];

    private scale: number;

    public constructor(scale: number) {
        this.scale = scale;
        this.init();
    }

    private init() {
        this.group = createSVGElement({
            element: 'g',
            attr: {
                id: 'cursorGroup',
                'visibility': 'hidden'
            }
        });
        this.group.append(this.getCursorPoint());
        this.group.append(this.getAttachPoint());
        this.group.append(this.getAttachTip());
        this.group.append(this.getDefault());
    }

    private getCursorPoint() {
        this.cursorPoint = createSVGElement({
            element: 'rect',
            attr: {
                fill: '',
                'fill-opacity': 1,
                width: POINT_SIZE / this.scale,
                height: POINT_SIZE / this.scale,
                rx: '0',
                ry: '0',
                stroke: THEME_COLOR,
                'stroke-width': POINT_WEIGHT / this.scale
            }
        });
        return this.cursorPoint;
    }

    private getAttachPoint() {
        this.attachPoint = createSVGElement({
            element: 'circle',
            attr: {
                r: ATTACH_POINT_RADIUS / this.scale,
                stroke: 'black',
                'stroke-opacity': 0.5,
                'stroke-width': POINT_WEIGHT / this.scale
            }
        });
        return this.attachPoint;
    }

    private getDefault() {
        const cursor: SVGSVGElement = createSVGElement({
            element: 'svg',
            attr: {
                width: cursorWidth / this.scale,
                height: cursorWidth / this.scale,
                viewBox: '0 0 90 90',
                fill: 'none'
            }
        });
        cursor.innerHTML = `<path fill-rule="evenodd" clip-rule="evenodd" d="M23.5153 20.7482L15.5274 25.36C15.5032 25.374 15.4728 25.3714 15.4513 25.3534L10.2199 20.9611C9.77617 20.5885 9.51581 20.0418 9.50625 19.4624L9.29584 6.7118C9.29544 6.68763 9.30818 6.66515 9.32911 6.65307L10.4141 6.02662C10.435 6.01458 10.4607 6.01474 10.4814 6.02703L21.3572 12.4842C21.8549 12.7797 22.2002 13.2763 22.3038 13.8457L23.5475 20.6786C23.5526 20.7063 23.5397 20.7341 23.5153 20.7482Z" stroke="#545659" />
        <path d="M14.4567 14.3853C13.8201 14.7528 13.602 15.5669 13.9695 16.2035C14.3371 16.8401 15.1511 17.0582 15.7877 16.6907C16.4243 16.3231 16.6425 15.5091 16.2749 14.8724C15.9074 14.2358 15.0933 14.0177 14.4567 14.3853Z" fill="#545659" />
        <path d="M15.1924 15.4975L10.201 6.85224" stroke="#545659" stroke-linecap="round" />
        <path d="M24.8867 23.0304L16.8178 27.689" stroke="#545659" stroke-linecap="round" />
        `;
        this.cursor = cursor;
        return this.cursor;
    }

    public getAttachTip() {
        this.attachTip = createSVGElement({
            element: 'g',
            attr: {
                visibility: 'hidden'
            }
        });
        this.attachTip.append(createSVGElement({
            element: 'path',
            attr: {
                stroke: 'red',
                d: '',
                'stroke-width': POINT_WEIGHT / this.scale
            }
        }));
        this.attachTip.append(createSVGElement({
            element: 'path',
            attr: {
                stroke: 'red',
                d: '',
                'stroke-width': POINT_WEIGHT / this.scale
            }
        }));
        return this.attachTip;
    }


    public update(leftKeyPressed: boolean, x: number, y: number) {
        if (this.mode !== MODE.DRAW) {
            return;
        }
        this.cursorCoordinate = [x, y];
        if (leftKeyPressed) {
            this.cursorPoint.setAttribute('x', `${x - POINT_RADIUS / this.scale}`);
            this.cursorPoint.setAttribute('y', `${y - POINT_RADIUS / this.scale}`);
            this.cursorPoint.setAttribute('rx', '0');
            this.cursorPoint.setAttribute('ry', '0');
        } else {
            this.cursorPoint.setAttribute('x', `${x - POINT_RADIUS / this.scale}`);
            this.cursorPoint.setAttribute('y', `${y - POINT_RADIUS / this.scale}`);
            this.cursorPoint.setAttribute('rx', `${POINT_RADIUS / this.scale}`);
            this.cursorPoint.setAttribute('ry', `${POINT_RADIUS / this.scale}`);
        }

        this.cursorPoint.setAttribute('fill', '');
        this.cursor.setAttribute('x', `${x - 11.5 / this.scale}`);
        this.cursor.setAttribute('y', `${y - 7 / this.scale}`);
    }

    public toogleVisible(visible: boolean) {
        this.group.setAttribute('visibility', visible ? 'visible' : 'hidden');
    }

    public isAttached() {
        return this.attachPoint.getAttribute('visibility') === 'visible';
    }

    public setAttachPoint(x?: number, y?: number) {
        if (x && y) {
            if (this.mode === MODE.DRAW) {
                this.attachPoint.setAttribute('cx', `${x + 22 / this.scale}`);
                this.attachPoint.setAttribute('cy', `${y + 14 / this.scale}`);
                this.attachPoint.setAttribute('visibility', 'visible');
            }

            const r = (POINT_SIZE / 2 - 1) / this.scale;
            const paths = [
                `M ${x - r} ${y - r} L ${x + r} ${y + r}`,
                `M ${x - r} ${y + r} L ${x + r} ${y - r}`,
            ];
            Array.from(this.attachTip.children).forEach((elem, index) => {
                elem.setAttribute('d', paths[index]);
            });
            this.attachTip.setAttribute('visibility', 'visible');
        } else {
            this.attachPoint.setAttribute('visibility', 'hidden');
            this.attachTip.setAttribute('visibility', 'hidden');
        }
    }

    public keyDown() {
        this.cursorPoint.setAttribute('fill', THEME_COLOR);
    }

    public updateScale(scale: number) { // just change the engineer scale
        this.scale = scale;

        this.cursorPoint.setAttribute('width', `${POINT_SIZE / this.scale}`);
        this.cursorPoint.setAttribute('height', `${POINT_SIZE / this.scale}`);
        this.cursorPoint.setAttribute('stroke-width', `${POINT_WEIGHT / this.scale}`);

        this.cursor.setAttribute('width', `${cursorWidth / this.scale}`);
        this.cursor.setAttribute('height', `${cursorWidth / this.scale}`);

        this.attachPoint.setAttribute('r', `${ATTACH_POINT_RADIUS / this.scale}`);
        this.attachPoint.setAttribute('stroke-width', `${POINT_WEIGHT / this.scale}`);

        Array.from(this.attachTip.children).forEach((elem) => {
            elem.setAttribute('stroke-width', `${POINT_WEIGHT / this.scale}`);
        });

        this.cursorPoint && this.update(
            this.cursorPoint.getAttribute('rx') === '0',
            ...this.cursorCoordinate
        );
    }
}

export default CursorGroup;
