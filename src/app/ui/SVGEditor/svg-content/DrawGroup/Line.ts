import { Bezier } from 'bezier-js';
import { createSVGElement } from '../../element-utils';
import { POINT_SIZE, THEME_COLOR, MINIMUM_SPACING } from './constants';
import { TCoordinate } from './types';

export type TLineConfig = {
    points?: TCoordinate[],
    elem?: SVGGElement,
    scale?: number;
    pointRadiusWithScale?: number;
    closedLoop?: boolean,
    fragmentID?: string,
    endPointsGroup?: SVGGElement;
    group?: SVGGElement;
}

class Line {
    public points: TCoordinate[];

    public endPoints: TCoordinate[];

    public elem: SVGGElement;

    public closedLoop: boolean;

    public fragmentID: string;

    private scale: number;
    private pointRadiusWithScale: number;

    private model: Bezier;

    private group: SVGGElement;
    private endPointsGroup: SVGGElement;

    private endPointEles: [SVGGElement, SVGGElement];

    public constructor(config: TLineConfig) {
        this.endPointsGroup = config.endPointsGroup;
        this.group = config.group;

        this.scale = config.scale;
        this.pointRadiusWithScale = config.pointRadiusWithScale;
        this.closedLoop = config.closedLoop || false;
        this.fragmentID = config.fragmentID;

        this.points = config.points;
        this.elem = config.elem;

        if (this.elem && !this.points) {
            this.elem = this.elem;
            this.points = this.parsePoints();
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            if (!this.elem.parentElement) {
                this.group.appendChild(this.elem);
                this.generateEndPointEle();
            }
        } else if (!this.elem && this.points) {
            const path = this.generatePath(this.points);
            const g = createSVGElement({
                element: 'g',
                attr: {
                    fragmentid: this.fragmentID
                }
            }) as SVGPathElement;
            g.innerHTML = `<path vector-effect="non-scaling-stroke" stroke="black" stroke-width="1" d="${path}"></path>
            <path vector-effect="non-scaling-stroke" stroke="transparent" stroke-width="5" d="${path}" data-preselect="1"></path>
            `;
            this.group.appendChild(g);
            this.elem = g;
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            this.generateEndPointEle();
        } else if (this.elem && this.points) {
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
        }

        setTimeout(() => {
            this.updateModel(this.points);
        }, 200);
    }

    private updateModel(points: TCoordinate[]) {
        const params = points.map((item) => {
            return {
                x: item[0],
                y: item[1]
            };
        }, []);
        this.model = new Bezier(params);
    }

    public updatePosition(points?: TCoordinate[], applyMerge?: boolean) {
        if (points && points.length > 0) {
            for (const child of this.elem.children) {
                child.setAttribute('d', this.generatePath(points));
            }
        }
        return this.updateEndPointEle(points, applyMerge);
    }

    private parsePoints() {
        const d = this.elem.children[0].getAttribute('d');
        const res: string[] = d.match(/\d+\.*\d*/g);
        const points: Array<[number, number]> = [];
        if (res) {
            for (let index = 0; index < res.length; index += 2) {
                points.push([
                    Number(res[index]),
                    Number(res[index + 1])
                ]);
            }
        }
        return points;
    }

    private updateEndPointEle(points?: TCoordinate[], applyMerge?: boolean) {
        if (points && points.length > 0) {
            const endPoints = points ? [
                points[0],
                points[points.length - 1]
            ] : this.endPoints;

            const endPointsEles = this.getEndPointEles();
            if (endPointsEles.length < 2) {
                return [];
            }

            endPoints.forEach((item, index) => {
                const x = item[0];
                const y = item[1];
                if (applyMerge) {
                    const circleElems = this.endPointsGroup.querySelectorAll<SVGGElement>(`g[cx="${x}"][cy="${y}"]`);
                    if (circleElems.length > 0) {
                        if (circleElems.length === 1) {
                            endPointsEles[index] = circleElems[0];
                            if (!circleElems[0].dataset[this.fragmentID]) {
                                // unMerge
                                const mergedPoint = this.endPointsGroup.querySelector<SVGGElement>(`g[data-${this.fragmentID}="${index}"]`);
                                if (mergedPoint) {
                                    // Ensure that the identification of points is not repeated
                                    delete mergedPoint.dataset[this.fragmentID];
                                }
                                circleElems[0].dataset[this.fragmentID] = `${index}`;
                            }
                        } else if (circleElems.length === 2) {
                            const retainPoint = Array.from(circleElems).find(elem => elem !== endPointsEles[index]);
                            retainPoint.dataset[this.fragmentID] = `${index}`;

                            endPointsEles[index].remove();
                            endPointsEles[index] = retainPoint;
                        }
                    } else {
                        // unMerge
                        const mergedPoint = this.endPointsGroup.querySelector<SVGGElement>(`g[data-${this.fragmentID}="${index}"]`);
                        if (mergedPoint) {
                            delete mergedPoint.dataset[this.fragmentID];
                        }

                        endPointsEles[index] = this.createCircle(item, index);
                    }
                }
                this.updateEndPointElemAttr(endPointsEles[index], x, y);
            });
            return points;
        } else {
            const _points = this.parsePoints();
            this.points = _points;
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            this.updateModel(_points);
            return this.updateEndPointEle(_points, applyMerge);
        }
    }

    private updateEndPointElemAttr(elem: SVGGElement, x: number, y: number) {
        elem.setAttribute('cx', `${x}`);
        elem.setAttribute('cy', `${y}`);

        for (const path of elem.children) {
            path.setAttribute('d', `M ${x} ${y} l 0.0001 0`);
        }
    }

    public generatePath(points: TCoordinate[]) {
        const length = points.length;
        switch (length) {
            case 2:
                return `M ${points[0].join(' ')} L ${points[1].join(' ')}`;
            case 3:
                return `M ${points[0].join(' ')} Q ${points[1].join(' ')}, ${points[2].join(' ')}`;
            case 4:
                return `M ${points[0].join(' ')} C ${points[1].join(' ')}, ${points[2].join(' ')}, ${points[3].join(' ')}`;
            default:
                return '';
        }
    }

    public getEndPointEles() {
        if (this.endPointEles) {
            return this.endPointEles;
        }
        this.endPointEles = [
            this.endPointsGroup.querySelector<SVGGElement>(`[data-${this.fragmentID}="0"]`),
            this.endPointsGroup.querySelector<SVGGElement>(`[data-${this.fragmentID}="1"]`)
        ];
        return this.endPointEles;
    }

    public generateEndPointEle() {
        this.endPoints.forEach((item, index) => {
            if (!item || !item[0]) {
                return;
            }
            let circle = this.endPointsGroup.querySelector<SVGRectElement>(`rect[type="end-point"][x="${item[0] - this.pointRadiusWithScale}"][y="${item[1] - this.pointRadiusWithScale}"]`);
            if (!circle) {
                circle = this.createCircle(item, index);
            } else {
                circle.dataset[`${this.fragmentID}`] = `${index}`;
            }
        });
    }

    private createCircle([x, y]: TCoordinate, index: number) {
        const elem = createSVGElement({
            element: 'g',
            attr: {
                type: 'end-point',
                cx: x,
                cy: y,
                stroke: THEME_COLOR,
                'pointer-events': 'all',
            }
        });
        elem.dataset[`${this.fragmentID}`] = index;
        elem.innerHTML = `<path d="M ${x} ${y} l 0.0001 0" stroke="#1890ff" stroke-linecap="round" stroke-width="12" vector-effect="non-scaling-stroke"/><path d="M ${x} ${y} l 0.0001 0" stroke="#fff" stroke-linecap="round" stroke-width="10" vector-effect="non-scaling-stroke" />`;
        this.endPointsGroup.appendChild(elem);
        return elem;
    }

    private calcSymmetryPoint([x, y]: TCoordinate, [x1, y1]: TCoordinate): TCoordinate {
        if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2) <= MINIMUM_SPACING) {
            return null;
        }
        return [2 * x1 - x, 2 * y1 - y];
    }

    public redrawCurve(x: number, y: number) {
        let points: TCoordinate[];
        if (this.points.length === 2) {
            const p = this.calcSymmetryPoint([x, y], this.points[1]);
            if (!p) {
                points = this.points;
            } else {
                points = [this.points[0], p, this.points[1]];
            }
        } else {
            const p = this.calcSymmetryPoint([x, y], this.points[2]);
            if (!p) {
                points = this.points;
            } else {
                points = [this.points[0], this.points[1], p, this.points[2]];
            }
        }
        const path = this.generatePath(points);
        for (const child of this.elem.children) {
            child.setAttribute('d', path);
        }
    }

    public del() {
        this.elem.remove();
    }

    public updateScale(scale: number, pointRadiusWithScale: number) {
        this.scale = scale;
        this.pointRadiusWithScale = pointRadiusWithScale;

        this.elem.setAttribute('stroke-width', `${1 / this.scale}`);
        this.getEndPointEles().forEach((elem) => {
            const index = elem.dataset[this.fragmentID];
            const item = this.endPoints[index];

            elem.setAttribute('width', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('height', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('rx', `${this.pointRadiusWithScale}`);
            elem.setAttribute('ry', `${this.pointRadiusWithScale}`);
            elem.setAttribute('x', `${item[0] - this.pointRadiusWithScale}`);
            elem.setAttribute('y', `${item[1] - this.pointRadiusWithScale}`);
            elem.setAttribute('stroke-width', `${1 / scale}`);
        });
    }

    public distanceDetection(x: number, y: number) {
        if (!this.model) {
            return 999;
        }
        const nearestPoint = this.model.project({ x, y });

        const a = nearestPoint.x - x;
        const b = nearestPoint.y - y;
        return Math.sqrt(a * a + b * b);
    }

    public isEndpointCoincidence() {
        const endPointEles = this.getEndPointEles();
        if (endPointEles.length < 2) {
            return false;
        }
        return (
            endPointEles[0].getAttribute('cx') === endPointEles[1].getAttribute('cx')
            && endPointEles[0].getAttribute('cy') === endPointEles[1].getAttribute('cy')
        );
    }
}

export default Line;
