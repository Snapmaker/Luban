import { createSVGElement, setAttributes } from './element-utils';

const ThemeColor = '#1890ff';

type TBbox = {
    x: number,
    y: number,
    width: number,
    height: number
}

class SVGSelector {
    public scale: number;
    public visible: boolean;

    private x = 0;
    private y = 0;
    private width = 0;
    private height = 0;

    private elem: SVGRectElement;

    private onlyContainSelect: boolean;

    public constructor(contentGroup: SVGGElement, scale: number) {
        this.scale = scale;
        this.elem = createSVGElement({
            element: 'rect',
            attr: {
                id: 'svg-selector',
                x: `${this.x}`,
                y: `${this.y}`,
                width: `${this.width}`,
                height: `${this.height}`,
                fill: ThemeColor,
                'fill-opacity': 0.2,
                stroke: ThemeColor,
                'stroke-width': 2 / this.scale,
                'stroke-opacity': 1
            }
        });
        contentGroup.append(this.elem);
    }

    public updateBox(x: number, y: number) {
        this.onlyContainSelect = x < this.x;

        this.width = Math.abs(x - this.x);
        this.height = Math.abs(y - this.y);

        setAttributes(this.elem, {
            x: Math.min(this.x, x),
            y: Math.min(this.y, y),
            width: this.width,
            height: this.height
        });
    }

    public updateScale(scale: number) {
        this.scale = scale;

        this.elem.setAttribute('stroke-width', `${2 / this.scale}`);
    }

    public setVisible(visible: boolean, x: number, y: number) {
        this.visible = visible;
        if (visible) {
            this.x = x;
            this.y = y;
            this.elem.setAttribute('width', '0');
            this.elem.setAttribute('height', '0');
        }
        this.elem.setAttribute('visibility', visible ? 'visible' : 'hidden');
    }

    public getBBox() {
        let selectorBbox = null as TBbox;
        if (this.x !== 0) {
            const x = Number(this.elem.getAttribute('x'));
            const y = Number(this.elem.getAttribute('y'));
            const width = Number(this.elem.getAttribute('width'));
            const height = Number(this.elem.getAttribute('height'));
            if (width !== 0 && height !== 0) {
                selectorBbox = {
                    x, y, width, height
                };
            }
        }
        const onlyContainSelect = this.onlyContainSelect;
        return {
            selectorBbox,
            onlyContainSelect
        };
    }
}

export default SVGSelector;
