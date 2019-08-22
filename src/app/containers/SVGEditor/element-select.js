import uuid from 'uuid';


class Selector {
    constructor(svgFactory, element, bbox) {
        // this.svgFactory = svgFactory;
        this.id = uuid.v4();

        this.element = element;

        this.selectorGroup = svgFactory.createSVGElement({
            element: 'g',
            attr: {
                id: `selector-group-${this.id}`
            }
        });

        this.selectorRect = svgFactory.createSVGElement({
            element: 'path',
            attr: {
                id: `selector-box-${this.id}`,
                fill: 'none',
                stroke: '#00b7ee',
                'stroke-width': 1,
                'stroke-dasharray': '8,8',
                style: 'pointer-event: none'
            }
        });
        this.selectorGroup.append(this.selectorRect);

        this.resize(bbox);
    }

    resize(bbox) {
        const rect = this.selectorRect;

        let offset = 1;
        if (this.element.getAttribute('stroke') !== 'none') {
            const strokeWidth = this.element.getAttribute('stroke-width');
            offset += strokeWidth / 2;
        }

        const x = bbox.x, y = bbox.y, w = bbox.width, h = bbox.height;

        const nx = x - offset;
        const ny = y - offset;
        const nw = w + offset * 2;
        const nh = h + offset * 2;

        const dstr = `M${nx},${ny} 
            L${nx + nw},${ny}
            L${nx + nw},${ny + nh}
            L${nx},${ny + nh} z`;

        rect.setAttribute('d', dstr);
    }
}

class SelectorManager {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;

        this.selectorParentGroup = null;

        this.selectors = [];

        this.selectorMap = {};

        this.initGroup();
    }

    initGroup() {
        this.selectorParentGroup = this.svgFactory.createSVGElement({
            element: 'g',
            attr: {
                id: 'selectorParentGroup'
            }
        });

        this.svgFactory.getRoot().append(this.selectorParentGroup);
    }

    requestSelector(elem, bbox) {
        if (this.selectorMap[elem.id]) {
            return this.selectorMap[elem.id];
        }

        const selector = new Selector(this.svgFactory, elem, bbox);
        this.selectors.push(selector);
        this.selectorMap[elem.id] = selector;
        this.selectorParentGroup.append(selector.selectorGroup);
        return selector;
    }

    releaseSelector(elem) {
        const selector = this.selectorMap[elem.id];

        delete this.selectorMap[elem.id];

        selector.selectorGroup.remove();

        this.selectors.splice(this.selectors.indexOf(selector), 1);
    }
}

export default SelectorManager;
