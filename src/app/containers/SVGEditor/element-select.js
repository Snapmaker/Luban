import uuid from 'uuid';
import { getBBox } from './element-utils';
import {
    transformBox,
    getTransformList,
    transformListToTransform
} from './element-transform';


class Selector {
    constructor(manager, svgFactory, element, bbox) {
        // this.svgFactory = svgFactory;
        this.manager = manager;
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
                style: 'pointer-events:none'
            }
        });
        this.selectorGroup.append(this.selectorRect);

        this.gripCoords = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.resize(bbox);
    }

    showGrips(show) {
        this.manager.selectorGripsGroup.setAttribute('display', show ? 'inline' : 'none');
    }

    resize(bbox) {
        const rect = this.selectorRect;

        let offset = 1;
        if (this.element.getAttribute('stroke') !== 'none') {
            const strokeWidth = this.element.getAttribute('stroke-width');
            offset += strokeWidth / 2;
        }

        if (!bbox) {
            bbox = getBBox(this.element);
        }

        const x = bbox.x, y = bbox.y, w = bbox.width, h = bbox.height;

        const transformList = getTransformList(this.element);
        // const m = transformList.numberOfItems ? transformList.getItem(0).matrix : IDENTITY; // TODO list to single transform
        const m = transformListToTransform(transformList).matrix;

        const transformedBox = transformBox(x, y, w, h, m);

        const nx = transformedBox.x - offset;
        const ny = transformedBox.y - offset;
        const nw = transformedBox.width + offset * 2;
        const nh = transformedBox.height + offset * 2;

        const dstr = `M${nx},${ny} 
            L${nx + nw},${ny}
            L${nx + nw},${ny + nh}
            L${nx},${ny + nh} z`;

        rect.setAttribute('d', dstr);

        // recalculate grip coordinates
        this.gripCoords = {
            nw: [nx, ny],
            ne: [nx + nw, ny],
            sw: [nx, ny + nh],
            se: [nx + nw, ny + nh],
            n: [nx + (nw) / 2, ny],
            w: [nx, ny + (nh) / 2],
            e: [nx + nw, ny + (nh) / 2],
            s: [nx + (nw) / 2, ny + nh]
        };

        Object.entries(this.gripCoords).forEach(([dir, coords]) => {
            const grip = this.manager.selectorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
    }
}

class SelectorManager {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;

        this.selectorParentGroup = null;

        // this will hold objects of type Selector (see above)
        this.selectors = [];

        // this holds a map of SVG elements to their Selector object
        this.selectorMap = {};

        // this holds a reference to the grip elements
        this.selectorGrips = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.initGroup();
    }

    initGroup() {
        // selectors
        this.selectorParentGroup = this.svgFactory.createSVGElement({
            element: 'g',
            attr: {
                id: 'selector-parent-group'
            }
        });

        this.svgFactory.getRoot().append(this.selectorParentGroup);

        // grips
        this.selectorGripsGroup = this.svgFactory.createSVGElement({
            element: 'g',
            attr: {
                display: 'none'
            }
        });
        for (const dir of Object.keys(this.selectorGrips)) {
            // TODO: cursor
            const grip = this.svgFactory.createSVGElement({
                element: 'circle',
                attr: {
                    id: `selector-grip-size-${dir}`,
                    fill: '#00b7ee',
                    r: 4,
                    'stroke-width': 1,
                    style: `cursor: ${dir}-resize`,
                    'pointer-events': 'all'
                }
            });
            grip.setAttribute('data-dir', dir);
            grip.setAttribute('data-type', 'resize');
            this.selectorGrips[dir] = grip;
            this.selectorGripsGroup.appendChild(grip);
        }

        this.selectorParentGroup.append(this.selectorGripsGroup);
    }

    requestSelector(elem, bbox) {
        if (this.selectorMap[elem.id]) {
            return this.selectorMap[elem.id];
        }

        const selector = new Selector(this, this.svgFactory, elem, bbox);
        this.selectors.push(selector);
        this.selectorMap[elem.id] = selector;
        this.selectorParentGroup.append(selector.selectorGroup);
        return selector;
    }

    releaseSelector(elem) {
        const selector = this.selectorMap[elem.id];
        selector.showGrips(false);

        delete this.selectorMap[elem.id];

        selector.selectorGroup.remove();

        this.selectors.splice(this.selectors.indexOf(selector), 1);
    }
}

export default SelectorManager;
