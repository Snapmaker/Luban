import * as THREE from 'three';
import { DEFAULT_LUBAN_HOST } from '../../constants';

export class ViewPathRenderer {
    async render(viewPaths, size) {
        await this._generateTexture();
        const objs = this._generateViewPathObjs(viewPaths);
        const background = this._generateBackground(viewPaths, size);

        const g = new THREE.Group();
        g.add(background);
        g.add(objs);

        return g;
    }

    _generateTexture() {
        return new Promise(resolve => {
            this.texture = new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`, () => {
                resolve();
            });
        });
    }

    _generateSvgViewPathObj(viewPath) {
        const { targetDepth, data, positionX, positionY } = viewPath;
        const shapePath = new THREE.ShapePath();
        for (let i = 0; i < data.length; i++) {
            const path = data[i];
            shapePath.moveTo(path[0].x, path[0].y);
            for (let j = 1; j < path.length; j++) {
                shapePath.lineTo(path[j].x, path[j].y);
            }
        }

        const mesh = this._generateMesh(shapePath.toShapes(), targetDepth);
        mesh.position.x = positionX;
        mesh.position.y = positionY;
        mesh.position.z = -targetDepth;

        return mesh;
    }

    _generateViewPathObj(viewPath) {
        const { isRotate, diameter, width, height, data } = viewPath;

        const radialSegments = data[0].length - 1;
        const heightSegments = data.length - 1;

        let geometry = null;
        if (isRotate) {
            geometry = new THREE.CylinderBufferGeometry(diameter / 2, diameter / 2, height, radialSegments, heightSegments);
        } else {
            geometry = new THREE.PlaneBufferGeometry(width, height, radialSegments, heightSegments);
        }
        const positions = geometry.attributes.position.array;

        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                const index = (i * data[i].length + j) * 3;
                positions[index] = data[i][j].x;
                positions[index + 2] = data[i][j].y;
            }
            if (isRotate) {
                if (i === 0) {
                    const topIndex = ((radialSegments + 1) * (heightSegments + 1) + radialSegments) * 3;
                    for (let j = 0; j < data[i].length; j++) {
                        const index = topIndex + j * 3;
                        positions[index] = data[i][j].x;
                        positions[index + 2] = data[i][j].y;
                    }
                }

                if (i === data.length - 1) {
                    const topIndex = ((radialSegments + 1) * (heightSegments + 1) + 3 * radialSegments + 1) * 3;
                    for (let j = 0; j < data[i].length; j++) {
                        const index = topIndex + j * 3;
                        positions[index] = data[i][j].x;
                        positions[index + 2] = data[i][j].y;
                    }
                }
            }
        }


        geometry.computeVertexNormals();

        const materials = this._generateMaterial();

        const mesh = new THREE.Mesh(geometry, materials);

        if (viewPath.positionX) {
            mesh.position.x = viewPath.positionX;
        }
        if (viewPath.positionY) {
            mesh.position.y = viewPath.positionY;
        }
        if (viewPath.rotationB) {
            mesh.rotation.y = viewPath.rotationB / 180 * Math.PI;
        }

        return mesh;
    }

    _generateViewPathObjs(viewPaths) {
        const group = new THREE.Group();
        for (const viewPath of viewPaths.data) {
            // eslint-disable-next-line no-unused-vars
            const { boundingBox } = viewPath;
            const mesh = this._generateViewPathObj(viewPath);

            if (!viewPaths.isRotate) {
                const boxPoints = this._generateByBox(boundingBox.min, boundingBox.max);
                const boxMesh = this._generateMesh(new THREE.Shape(boxPoints),
                    viewPaths.targetDepth - boundingBox.length.z - 1, '#cccccc');
                boxMesh.position.z = -viewPaths.targetDepth;
                group.add(boxMesh);
            }
            group.add(mesh);
        }

        return group;
    }

    _generateBackground(viewPaths, size) {
        const group = new THREE.Group();
        if (viewPaths.isRotate) {
            let start = 0;
            const holes = viewPaths.holes;
            for (const hole of holes) {
                if (hole.min > start) {
                    const geometry = new THREE.CylinderGeometry(viewPaths.diameter / 2, viewPaths.diameter / 2, hole.min - start, 32);
                    const material = this._generateMaterial();
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = (hole.min + start) / 2;
                    group.add(mesh);
                }
                start = hole.max;
            }
            if (size.y > start) {
                const geometry = new THREE.CylinderGeometry(viewPaths.diameter / 2, viewPaths.diameter / 2, size.y - start, 32);
                const material = this._generateMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = (size.y + start) / 2;
                group.add(mesh);
            }
        } else {
            const points = this._generateByBox({ x: size.minX, y: size.minY }, { x: size.maxX, y: size.maxY });

            const shape = new THREE.Shape(points);

            for (const hole of viewPaths.holes) {
                shape.holes.push(new THREE.Shape(hole));
            }

            const mesh = this._generateMesh(shape, viewPaths.targetDepth);
            mesh.position.z = -viewPaths.targetDepth;
            group.add(mesh);
        }
        return group;
    }

    _generateByBox(min, max) {
        return [
            { x: min.x, y: min.y },
            { x: max.x, y: min.y },
            { x: max.x, y: max.y },
            { x: min.x, y: max.y },
            { x: min.x, y: min.y }
        ];
    }

    _generateMaterial(color = '#cea775') {
        return new THREE.MeshPhongMaterial(
            {
                color: color,
                shininess: 0
            }
        );
    }

    _generateMesh(shapes, depth, color) {
        const geometry = new THREE.ExtrudeGeometry(shapes, {
            steps: 2,
            depth: depth,
            bevelEnabled: false
        });
        return new THREE.Mesh(geometry, this._generateMaterial(color));
    }
}
