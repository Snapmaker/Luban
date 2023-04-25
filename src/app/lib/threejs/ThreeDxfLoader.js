import * as THREE from 'three';
import request from 'superagent';
import { isUndefined } from 'lodash';
import log from '../log';
import DxfParser from '../../../shared/lib/DXFParser';
import { measureBoundary } from '../../../shared/lib/DXFParser/Parser';
import DxfShader from './DxfShaderLine';
import { EPSILON } from '../../constants';

/**
 * Returns the angle in radians of the vector (p1,p2). In other words, imagine
 * putting the base of the vector at coordinates (0,0) and finding the angle
 * from vector (1,0) to (p1,p2).
 * @param  {Object} p1 start point of the vector
 * @param  {Object} p2 end point oNf the vector
 * @return {Number} the angle
 */
function angle2(p1, p2) {
    const v1 = new THREE.Vector2(p1.x, p1.y);
    const v2 = new THREE.Vector2(p2.x, p2.y);
    v2.sub(v1); // sets v2 to be our chord
    v2.normalize();
    if (v2.y < 0) return -Math.acos(v2.x);
    return Math.acos(v2.x);
}

function polar(point, distance, angle) {
    const result = {};
    result.x = point.x + distance * Math.cos(angle);
    result.y = point.y + distance * Math.sin(angle);
    return result;
}

function isEqual(a, b) {
    return Math.abs(a - b) < EPSILON;
}

function BulgeGeometry(startPoint, endPoint, bulge, segments) {
    let vertex, i;
    THREE.Geometry.call(this);
    const p0 = startPoint ? new THREE.Vector2(startPoint.x, startPoint.y) : new THREE.Vector2(0, 0);
    const p1 = endPoint ? new THREE.Vector2(endPoint.x, endPoint.y) : new THREE.Vector2(1, 0);
    bulge = bulge || 1;
    this.startPoint = p0;
    this.endPoint = p1;
    this.bulge = bulge;

    const angle = 4 * Math.atan(bulge);
    const radius = p0.distanceTo(p1) / 2 / Math.sin(angle / 2);
    const center = polar(startPoint, radius, angle2(p0, p1) + (Math.PI / 2 - angle / 2));

    if (segments !== undefined) {
        this.segments = segments;
    } else {
        this.segments = Math.max(Math.abs(Math.ceil(angle / (Math.PI / 36))), 6); // By default want a segment roughly every 5 degrees
    }
    const startAngle = angle2(center, p0);
    const thetaAngle = angle / this.segments;


    this.vertices.push(new THREE.Vector3(p0.x, p0.y, 0));

    for (i = 1; i <= this.segments - 1; i++) {
        vertex = polar(center, Math.abs(radius), startAngle + thetaAngle * i);

        this.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));
    }
}

BulgeGeometry.prototype = Object.create(THREE.Geometry.prototype);

/**
 * Calculates points for a curve between two points
 * @param startPoint - the starting point of the curve
 * @param endPoint - the ending point of the curve
 * @param bulge - a value indicating how much to curve
 * @param segments - number of segments between the two given points
 */
class ThreeDxfLoader {
    constructor(options = {}) {
        const { font, width, height } = options;
        this.font = font;
        this.width = width;
        this.height = height;
    }

    getColor(entity, data) {
        let color = 0x000000; // default
        if (entity.color) color = entity.color;
        else if (data.tables && data.tables.layer && data.tables.layer.layers[entity.layer]) color = data.tables.layer.layers[entity.layer].color;

        if (color == null || color === 0xffffff) {
            color = 0x000000;
        }
        return color;
    }

    drawCircle(geometry, entity, data) {
        const color = new THREE.Color(this.getColor(entity, data));
        const interpolatedPoints = new THREE.CircleGeometry(entity.radius, 32, entity.startAngle, entity.angleLength);
        const defaultColor = new THREE.Color(0xffffff);

        interpolatedPoints.vertices.map((item) => {
            item.x += entity.center.x;
            item.y += entity.center.y;
            item.z += entity.center.z;
            return item;
        });
        interpolatedPoints.vertices.shift();

        let previousPosition = { x: 0, y: 0, z: 0 };
        if (geometry.vertices.length > 0) {
            previousPosition = geometry.vertices[geometry.vertices.length - 1];
        }
        if (!isEqual(previousPosition.x, interpolatedPoints.vertices[0].x)
            || !isEqual(previousPosition.y, interpolatedPoints.vertices[0].y)) {
            geometry.vertices.push(previousPosition);
            geometry.colors.push(defaultColor);
            geometry.vertices.push(interpolatedPoints.vertices[0]);
            geometry.colors.push(defaultColor);
        }


        geometry.vertices.push(...interpolatedPoints.vertices);
        geometry.colors.push(...new Array(interpolatedPoints.vertices.length).fill(color));
    }

    drawSolid(geometry, entity) {
        // const geometry = new THREE.Geometry();

        const verts = geometry.vertices;
        verts.push(new THREE.Vector3(entity.points[0].x, entity.points[0].y, entity.points[0].z));
        verts.push(new THREE.Vector3(entity.points[1].x, entity.points[1].y, entity.points[1].z));
        verts.push(new THREE.Vector3(entity.points[2].x, entity.points[2].y, entity.points[2].z));
        verts.push(new THREE.Vector3(entity.points[3].x, entity.points[3].y, entity.points[3].z));

        // Calculate which direction the points are facing (clockwise or counter-clockwise)
        const vector1 = new THREE.Vector3();
        const vector2 = new THREE.Vector3();
        vector1.subVectors(verts[1], verts[0]);
        vector2.subVectors(verts[2], verts[0]);
        vector1.cross(vector2);

        // If z < 0 then we must draw these in reverse order
        if (vector1.z < 0) {
            geometry.faces.push(new THREE.Face3(2, 1, 0));
            geometry.faces.push(new THREE.Face3(2, 3, 1));
        } else {
            geometry.faces.push(new THREE.Face3(0, 1, 2));
            geometry.faces.push(new THREE.Face3(1, 3, 2));
        }
    }

    drawText(entity, data) {
        if (!this.font) return log.warn('Text is not supported without a Three.js font loaded with THREE.FontLoader! Load a font of your choice and pass this into the constructor. See the sample for this repository or Three.js examples at http://threejs.org/examples/?q=text#webgl_geometry_text for more details.');

        const geometry = new THREE.TextGeometry(entity.text, { font: this.font, height: 0, size: entity.textHeight || 12 });

        const material = new THREE.MeshBasicMaterial({ color: this.getColor(entity, data) });

        const text = new THREE.Mesh(geometry, material);
        text.position.x = entity.startPoint.x;
        text.position.y = entity.startPoint.y;
        text.position.z = entity.startPoint.z;

        return text;
    }

    drawPoint(entity, data) {
        const geometry = new THREE.Geometry();

        geometry.vertices.push(new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z));

        // TODO: could be more efficient. PointCloud per layer?

        const numPoints = 1;

        const color = this.getColor(entity, data);
        const colors = new Float32Array(numPoints * 3);
        colors[0] = color.r;
        colors[1] = color.g;
        colors[2] = color.b;

        geometry.colors = colors;
        geometry.computeBoundingBox();

        const material = new THREE.PointsMaterial({ size: 0.05, vertexColors: THREE.VertexColors });
        const point = new THREE.Points(geometry, material);
        return point;
    }

    createDashedLineShader(pattern) {
        let i;
        const dashedLineShader = {};
        let totalLength = 0.0;

        for (i = 0; i < pattern.length; i++) {
            totalLength += Math.abs(pattern[i]);
        }

        dashedLineShader.uniforms = THREE.UniformsUtils.merge([

            THREE.UniformsLib.common,
            THREE.UniformsLib.fog,

            {
                'pattern': { type: 'fv1', value: pattern },
                'patternLength': { type: 'f', value: totalLength }
            }

        ]);

        dashedLineShader.vertexShader = [
            'attribute float lineDistance;',

            'varying float vLineDistance;',

            THREE.ShaderChunk.color_pars_vertex,

            'void main() {',

            THREE.ShaderChunk.color_vertex,

            'vLineDistance = lineDistance;',

            'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

            '}'
        ].join('\n');

        dashedLineShader.fragmentShader = [
            'uniform vec3 diffuse;',
            'uniform float opacity;',

            `uniform float pattern[${pattern.length}];`,
            'uniform float patternLength;',

            'varying float vLineDistance;',

            THREE.ShaderChunk.color_pars_fragment,
            THREE.ShaderChunk.fog_pars_fragment,

            'void main() {',

            'float pos = mod(vLineDistance, patternLength);',

            `for ( int i = 0; i < ${pattern.length}; i++ ) {`,
            'pos = pos - abs(pattern[i]);',
            'if( pos < 0.0 ) {',
            'if( pattern[i] > 0.0 ) {',
            'gl_FragColor = vec4(1.0, 0.0, 0.0, opacity );',
            'break;',
            '}',
            'discard;',
            '}',

            '}',

            THREE.ShaderChunk.color_fragment,
            THREE.ShaderChunk.fog_fragment,

            '}'
        ].join('\n');

        return dashedLineShader;
    }

    drawEllipse(geometry, entity, data) {
        const color = new THREE.Color(this.getColor(entity, data));
        const xrad = Math.sqrt((entity.majorAxisEndPoint.x ** 2) + (entity.majorAxisEndPoint.y ** 2));
        const yrad = xrad * entity.axisRatio;
        const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);
        const defaultColor = new THREE.Color(0xffffff);

        const curve = new THREE.EllipseCurve(
            entity.center.x, entity.center.y,
            xrad, yrad,
            entity.startAngle, entity.endAngle,
            false, // Always counterclockwise
            rotation
        );
        const interpolatedPoints = curve.getPoints(80);
        let previousPosition = { x: 0, y: 0, z: 0 };
        if (geometry.vertices.length > 0) {
            previousPosition = geometry.vertices[geometry.vertices.length - 1];
        }
        if (!isEqual(previousPosition.x, interpolatedPoints[0].x)
            || !isEqual(previousPosition.y, interpolatedPoints[0].y)) {
            geometry.vertices.push(interpolatedPoints[0]);
            geometry.colors.push(defaultColor);
        }
        interpolatedPoints.forEach((item) => {
            if (isUndefined(item.z)) {
                item.z = 0;
            }
            geometry.vertices.push(item);
            geometry.colors.push(color);
        });
        geometry.vertices.push(interpolatedPoints[interpolatedPoints.length - 1]);
        geometry.colors.push(defaultColor);
    }

    drawMtext(entity, data) {
        const color = this.getColor(entity, data);

        const geometry = new THREE.TextGeometry(entity.text, {
            font: this.font,
            size: entity.height * (4 / 5),
            height: 1
        });
        const material = new THREE.MeshBasicMaterial({ color: color });
        const text = new THREE.Mesh(geometry, material);

        // Measure what we rendered.
        const measure = new THREE.Box3();
        measure.setFromObject(text);

        const textWidth = measure.max.x - measure.min.x;

        // If the text ends up being wider than the box, it's supposed
        // to be multiline. Doing that in threeJS is overkill.
        if (textWidth > entity.width) {
            log.warn("Can't render this multipline MTEXT entity, sorry.", entity);
            return undefined;
        }

        text.position.z = 0;
        switch (entity.attachmentPoint) {
            case 1:
                // Top Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y - entity.height;
                break;
            case 2:
                // Top Center
                text.position.x = entity.position.x - textWidth / 2;
                text.position.y = entity.position.y - entity.height;
                break;
            case 3:
                // Top Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y - entity.height;
                break;

            case 4:
                // Middle Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y - entity.height / 2;
                break;
            case 5:
                // Middle Center
                text.position.x = entity.position.x - textWidth / 2;
                text.position.y = entity.position.y - entity.height / 2;
                break;
            case 6:
                // Middle Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y - entity.height / 2;
                break;

            case 7:
                // Bottom Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y;
                break;
            case 8:
                // Bottom Center
                text.position.x = entity.position.x - textWidth / 2;
                text.position.y = entity.position.y;
                break;
            case 9:
                // Bottom Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y;
                break;

            default:
                return undefined;
        }

        return text;
    }

    drawSpline(splineGeo, entity, data) {
        const color = new THREE.Color(this.getColor(entity, data));
        const defaultColor = new THREE.Color(0xffffff);
        let points;
        let interpolatedPoints = [];
        let curve;
        if (entity.fitPoints && entity.fitPoints.length > 0) {
            points = entity.fitPoints.map((vec) => {
                return new THREE.Vector2(vec.x, vec.y);
            });
            if (entity.degreeOfSplineCurve === 2) {
                for (let i = 0; i + 2 < points.length; i += 2) {
                    curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                    interpolatedPoints.push(...curve.getPoints(points.length));
                }
            } else {
                curve = new THREE.SplineCurve(points);
                interpolatedPoints = curve.getPoints(points.length * 8);
            }
        } else {
            if (entity.controlPoints && entity.controlPoints.length > 7) {
                interpolatedPoints = entity.controlPoints;
            } else {
                if (entity.controlPoints.length === 4) {
                    let p0, p1;
                    for (let t = 0; t < 1; t += 0.01) {
                        p0 = (1 - t) ** 3 * entity.controlPoints[0].x + 3 * t * (1 - t) ** 2 * entity.controlPoints[1].x
                        + 3 * t ** 2 * (1 - t) * entity.controlPoints[2].x + t ** 3 * entity.controlPoints[3].x;
                        p1 = (1 - t) ** 3 * entity.controlPoints[0].y + 3 * t * (1 - t) ** 2 * entity.controlPoints[1].y
                        + 3 * t ** 2 * (1 - t) * entity.controlPoints[2].y + t ** 3 * entity.controlPoints[3].y;
                        interpolatedPoints.push({ x: p0, y: p1, z: 0 });
                    }
                } else {
                    points = entity.controlPoints.map((vec) => {
                        return new THREE.Vector2(vec.x, vec.y);
                    });
                    if (entity.degreeOfSplineCurve === 2) {
                        for (let i = 0; i + 2 < points.length; i += 2) {
                            curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                            interpolatedPoints.push(...curve.getPoints(points.length));
                        }
                    } else {
                        curve = new THREE.SplineCurve(points);
                        interpolatedPoints = curve.getPoints(points.length * 2);
                    }
                }
            }
        }

        let previewPositon;
        if (splineGeo.vertices.length > 0) {
            previewPositon = splineGeo.vertices[splineGeo.vertices.length - 1];
        } else {
            previewPositon = interpolatedPoints[0];
        }
        if (!isEqual(previewPositon.x, interpolatedPoints[0].x)
            || !isEqual(previewPositon.y, interpolatedPoints[0].y)) {
            splineGeo.vertices.push(previewPositon);
            splineGeo.colors.push(defaultColor);
            splineGeo.vertices.push(interpolatedPoints[0]);
            splineGeo.colors.push(defaultColor);
        }
        interpolatedPoints.forEach((item) => {
            if (isUndefined(item.z)) {
                item.z = 0;
            }
            splineGeo.vertices.push(item);
            splineGeo.colors.push(color);
        });
    }

    drawLine(geometry, entity, data) {
        const color = new THREE.Color(this.getColor(entity, data));
        let vertex, startPoint, endPoint, bulgeGeometry,
            bulge, i;
        const defaultColor = new THREE.Color(0xffffff);

        const interpolatedPoints = [];
        // create geometry
        for (i = 0; i < entity.vertices.length; i++) {
            if (entity.vertices[i].bulge) {
                bulge = entity.vertices[i].bulge;
                startPoint = entity.vertices[i];
                endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : entity.vertices[0];

                bulgeGeometry = new BulgeGeometry(startPoint, endPoint, bulge);
                interpolatedPoints.push(...bulgeGeometry.vertices);
            } else {
                vertex = entity.vertices[i];
                interpolatedPoints.push(new THREE.Vector3(vertex.x, vertex.y, 0));
            }
        }
        if (entity.vertices.length > 2 && entity.shape === true) {
            interpolatedPoints.push(new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0));
        }
        let previewPositon = { x: 0, y: 0, z: 0 };
        if (geometry.vertices.length > 0) {
            previewPositon = geometry.vertices[geometry.vertices.length - 1];
        }
        if (!isEqual(previewPositon.x, interpolatedPoints[0].x)
            || !isEqual(previewPositon.y, interpolatedPoints[0].y)) {
            geometry.vertices.push(interpolatedPoints[0]);
            geometry.colors.push(defaultColor);
        }
        interpolatedPoints.forEach((item) => {
            if (isUndefined(item.z)) {
                item.z = 0;
            }
            geometry.vertices.push(item);
            geometry.colors.push(color);
        });
        geometry.vertices.push(interpolatedPoints[interpolatedPoints.length - 1]);
        geometry.colors.push(defaultColor);
    }


    drawEntity(typeGeometries, entity, data) {
        let mesh;
        let geometry;
        if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            geometry = typeGeometries.LINE;
        } else if (entity.type === 'ARC') {
            geometry = typeGeometries.CIRCLE;
        } else {
            geometry = typeGeometries[entity.type];
        }
        if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
            this.drawCircle(geometry, entity, data);
        } else if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            this.drawLine(geometry, entity, data);
        } else if (entity.type === 'TEXT') {
            mesh = this.drawText(entity, data);
        } else if (entity.type === 'SOLID') {
            this.drawSolid(geometry, entity);
        } else if (entity.type === 'POINT') {
            mesh = this.drawPoint(entity, data);
        } else if (entity.type === 'SPLINE') {
            this.drawSpline(geometry, entity, data);
        } else if (entity.type === 'MTEXT') {
            mesh = this.drawMtext(entity, data);
        } else if (entity.type === 'ELLIPSE') {
            this.drawEllipse(geometry, entity, data);
        } else if (entity.type === 'INSERT') {
            return mesh;
        } else {
            log.warn(`Unsupported Entity Type: ${entity.type}`);
        }


        return mesh;
    }

    normalizer(dxfString, scale) {
        const dxf = dxfString;
        // entities
        const { minX, maxX, minY, maxY } = dxf.boundary;
        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;

        for (const entities of dxf.entities) {
            if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE' || entities.type === 'POLYLINE') {
                entities.vertices.map((point) => {
                    point.x = this.translateAndScale(point.x, centerX, scale);
                    point.y = this.translateAndScale(point.y, centerY, scale);
                    return point;
                });
            } else if (entities.type === 'SPLINE') {
                entities.controlPoints.map((point) => {
                    point.x = this.translateAndScale(point.x, centerX, scale);
                    point.y = this.translateAndScale(point.y, centerY, scale);
                    return point;
                });
                if (entities.fitPoints && entities.fitPoints.length > 0) {
                    entities.fitPoints.map((point) => {
                        point.x = this.translateAndScale(point.x, centerX, scale);
                        point.y = this.translateAndScale(point.y, centerY, scale);
                        return point;
                    });
                }
            } else if (entities.type === 'POINT') {
                const position = entities.position;
                if (position.x === 0 && position.y === 0) {
                    continue;
                }
                position.x = this.translateAndScale(position.x, centerX, scale);
                position.y = this.translateAndScale(position.y, centerY, scale);
            } else if (entities.type === 'CIRCLE' || entities.type === 'ARC') {
                const { center } = entities;
                center.x = this.translateAndScale(center.x, centerX, scale);
                center.y = this.translateAndScale(center.y, centerY, scale);
                entities.radius = this.translateAndScale(entities.radius, 0, scale);
            } else if (entities.type === 'ELLIPSE') {
                const { center, majorAxisEndPoint } = entities;
                center.x = this.translateAndScale(center.x, centerX, scale);
                center.y = this.translateAndScale(center.y, centerY, scale);
                majorAxisEndPoint.x = this.translateAndScale(majorAxisEndPoint.x, 0, scale);
                majorAxisEndPoint.y = this.translateAndScale(majorAxisEndPoint.y, 0, scale);
            }
        }

        dxf.boundary = {
            minX: minX - centerX,
            maxX: maxX - centerX,
            minY: minY - centerY,
            maxY: maxY - centerY
        };

        return dxf;
    }

    translateAndScale(num, distance, scale) {
        return (num - distance) * scale;
    }

    load(path, onLoad) {
        // Create scene from dxf object (dxfStr)
        const parser = new DxfParser();
        request.get(path).end((err, res) => {
            const result = res.text;
            const dxf = parser.parseSync(result);

            let scale = 1;
            measureBoundary(dxf);
            if (this.width) {
                scale = this.width / dxf.width;
            }
            this.normalizer(dxf, scale);

            const typeGeometries = {
                CIRCLE: new THREE.Geometry(),
                LINE: new THREE.Geometry(),
                SPLINE: new THREE.Geometry(),
                ELLIPSE: new THREE.Geometry(),
                SOLID: new THREE.Geometry()
                // TEXT: new THREE.Geometry(),
                // POINT: new THREE.Geometry(),
                // MTEXT: new THREE.Geometry()
            };
            const group = new THREE.Group();
            let obj;
            for (let i = 0; i < dxf.entities.length; i++) {
                const entity = dxf.entities[i];

                if (entity.type === 'DIMENSION') {
                    if (entity.block) {
                        const block = dxf.blocks[entity.block];
                        if (!block) {
                            continue;
                        }
                        for (let j = 0; j < block.entities.length; j++) {
                            obj = this.drawEntity(typeGeometries, block.entities[j], dxf);
                        }
                    } else {
                        log.warn('WARNING: No block for DIMENSION entity');
                    }
                } else {
                    obj = this.drawEntity(typeGeometries, entity, dxf);
                }
                if (obj) {
                    group.add(obj);
                }
                obj = null;
            }
            Object.entries(typeGeometries)
                .forEach(([key, item]) => {
                    if (key === 'SOLID') {
                        group.add(new THREE.Mesh(
                            item,
                            new THREE.MeshBasicMaterial({ color: 0xffffff })
                        ));
                    } else {
                        const positions = [];
                        const colors = [];
                        for (const v of item.vertices) {
                            positions.push(v.x);
                            positions.push(v.y);
                            positions.push(v.z);
                        }
                        for (const color of item.colors) {
                            colors.push(color.r);
                            colors.push(color.g);
                            colors.push(color.b);
                            if (color.r === 1 && color.g === 1 && color.b === 1) {
                                colors.push(0);
                            } else {
                                colors.push(1);
                            }
                        }
                        const bufferGeometry = new THREE.BufferGeometry();
                        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                        const colorAttribute = new THREE.Uint8BufferAttribute(colors, 4);

                        bufferGeometry.setAttribute('position', positionAttribute);
                        bufferGeometry.setAttribute('a_color', colorAttribute);

                        const obj3d = new DxfShader.Line(bufferGeometry);

                        group.add(obj3d);
                    }
                });
            onLoad && onLoad(group);
        });
    }
}

export default ThreeDxfLoader;
