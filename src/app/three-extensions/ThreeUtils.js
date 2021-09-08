import * as THREE from 'three';

const ThreeUtils = {
    getQuaternionBetweenVector3(v1, v2) {
        // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
        const cross = new THREE.Vector3();
        cross.crossVectors(v2, v1);
        const dot = v1.dot(v2);

        const l1 = v1.length();
        const l2 = v2.length();
        const w = l1 * l2 + dot;
        const x = cross.x;
        const y = cross.y;
        const z = cross.z;

        const quaternion = new THREE.Quaternion(x, y, z, w);
        quaternion.normalize();

        return quaternion;
    },

    // get matrix for rotating v2 to v1. Applying matrix to v2 can make v2 to parallels v1.
    getRotateMatrixBetweenVector3(v1, v2) {
        const quaternion = ThreeUtils.getQuaternionBetweenVector3(v1, v2);
        const matrix4 = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
        return matrix4;
    },

    getMouseXY(event, domElement) {
        const rect = domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    },

    // get world info
    getObjectWorldPosition(object) {
        const result = new THREE.Vector3();
        object.getWorldPosition(result);
        return result;
    },

    getObjectWorldQuaternion(object) {
        const result = new THREE.Quaternion();
        object.getWorldQuaternion(result);
        return result;
    },

    getObjectWorldScale(object) {
        const result = new THREE.Vector3();
        object.getWorldScale(result);
        return result;
    },

    getEventWorldPosition(event, domElement, camera) {
        const rect = domElement.getBoundingClientRect();
        const tempVector3 = new THREE.Vector3();

        // the x&y in standard thereejs coordinate
        // standardX, standardY: [-1, 1]
        const standardX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const standardY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        tempVector3.set(standardX, standardY, 0.5);

        tempVector3.unproject(camera);
        tempVector3.sub(camera.position).normalize();
        const distance = -camera.position.z / tempVector3.z;

        const result = new THREE.Vector3().copy(camera.position).add(tempVector3.multiplyScalar(distance));
        return result;
    },

    // set world transformation
    setObjectWorldPosition(object, position) {
        const parent = object.parent;
        parent.updateMatrixWorld();
        const matrix = new THREE.Matrix4().getInverse(parent.matrixWorld);
        position.applyMatrix4(matrix);
        object.position.copy(position);
    },

    setObjectWorldScale(object, scale) {
        const localScale = object.parent.worldToLocal(scale);
        object.scale.copy(localScale);
    },

    setObjectWorldQuaternion(object, quaternion) {
        object.setRotationFromQuaternion(quaternion);

        const parentQuaternion = ThreeUtils.getObjectWorldQuaternion(object.parent);
        object.applyQuaternion(parentQuaternion.inverse());
    },

    scaleObjectToWorldSize(object, targetSize, pivot) {
        const originSize2D = ThreeUtils.getGeometrySize(object.geometry, true);

        const originPos = ThreeUtils.getObjectWorldPosition(object);
        const originScale = ThreeUtils.getObjectWorldScale(object);

        const scaleX = targetSize.x / originSize2D.x;
        const scaleY = targetSize.y / originSize2D.y;

        const worldScale = new THREE.Vector3(scaleX, scaleY, 1);
        ThreeUtils.setObjectWorldScale(object, worldScale);

        const deltaX = (scaleX - originScale.x) * originSize2D.x;
        const deltaY = (scaleY - originScale.y) * originSize2D.y;

        const newPos = originPos.clone();
        const delta = new THREE.Vector3();
        switch (pivot) {
            case 'top_left':
                delta.x = deltaX / 2;
                delta.y = -deltaY / 2;
                break;
            case 'top_right':
                delta.x = -deltaX / 2;
                delta.y = -deltaY / 2;
                break;
            case 'bottom_left':
                delta.x = deltaX / 2;
                delta.y = deltaY / 2;
                break;
            case 'bottom_right':
                delta.x = -deltaX / 2;
                delta.y = deltaY / 2;
                break;
            default: // center
                break;
        }
        newPos.add(delta);
        ThreeUtils.setObjectWorldPosition(object, newPos);
    },

    getGeometrySize(geometry, is2D) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = new THREE.Vector3(
            box.max.x - box.min.x,
            box.max.y - box.min.y,
            box.max.z - box.min.z
        );
        if (is2D) {
            return new THREE.Vector2(size.x, size.y);
        } else {
            return size;
        }
    },

    generateSupportBoxGeometry(width, height, topZ, bottomZ = 0) {
        const depth = topZ - bottomZ;
        const box = new THREE.BoxBufferGeometry(width, height, depth).toNonIndexed();
        box.translate(0, 0, depth / 2 + bottomZ);
        return box;
    },

    removeObjectParent(obj) {
        const parent = obj.parent;
        if (!parent) return () => {};

        parent.updateMatrixWorld();
        parent.remove(obj);
        obj.applyMatrix(parent.matrixWorld);
        return () => this.setObjectParent(obj, parent);
    },

    setObjectParent(obj, parent) {
        if (!parent) return;

        this.removeObjectParent(obj);
        parent.updateMatrixWorld();
        obj.applyMatrix(new THREE.Matrix4().getInverse(parent.matrixWorld));
        parent.add(obj);
    },
    applyObjectMatrix(obj, matrix) {
        const inverse = new THREE.Matrix4().getInverse(matrix);
        obj.children.forEach(child => {
            child.applyMatrix(inverse);
        });
        obj.applyMatrix(matrix);
    },
    liftObjectOnlyChildMatrix(obj) {
        if (obj.children.length !== 1) return;

        const child = obj.children[0];
        const m = child.matrix;
        obj.applyMatrix(m);
        child.applyMatrix(new THREE.Matrix4().getInverse(m));
    },
    // eslint-disable-next-line func-names
    computeBoundingBox: (function () {
        const caches = {};
        const initialBox = new THREE.Box3();

        let i, l;
        const v1 = new THREE.Vector3();
        function compute(node, box) {
            const geometry = node.geometry;

            if (geometry !== undefined) {
                if (geometry.isGeometry) {
                    const vertices = geometry.vertices;

                    for (i = 0, l = vertices.length; i < l; i++) {
                        v1.copy(vertices[i]);
                        v1.applyMatrix4(node.matrixWorld);

                        box.expandByPoint(v1);
                    }
                } else if (geometry.isBufferGeometry) {
                    const attribute = geometry.attributes.position;

                    if (attribute !== undefined) {
                        for (i = 0, l = attribute.count; i < l; i++) {
                            v1.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld);

                            box.expandByPoint(v1);
                        }
                    }
                }
            }
        }

        return function computeBoundingBox(obj) {
            let cache = caches[obj.uuid];
            if (!cache) {
                cache = {
                    lastMatrix: new THREE.Matrix4(),
                    lastBbox: new THREE.Box3(),
                    childrenMatrix: []
                };
                caches[obj.uuid] = cache;
            }
            const { lastMatrix, lastBbox } = cache;

            obj.updateMatrixWorld();
            if (obj.geometry) {
                const isChildrenMatrixChanged = obj.children.some((child, j) => !(cache.childrenMatrix[j] && child.matrixWorld.equals(cache.childrenMatrix[j])));
                if (lastBbox.isEmpty() || !lastMatrix.equals(obj.matrixWorld) || isChildrenMatrixChanged) {
                    cache.childrenMatrix = obj.children.map(child => child.matrixWorld.clone());
                    lastBbox.copy(initialBox);
                    compute(obj, lastBbox);
                    lastMatrix.copy(obj.matrixWorld);
                }
            } else {
                lastBbox.copy(initialBox);
            }

            for (const child of obj.children) {
                const cBBox = ThreeUtils.computeBoundingBox(child);
                if (!cBBox.isEmpty()) {
                    lastBbox.expandByPoint(cBBox.min).expandByPoint(cBBox.max);
                }
            }
            return lastBbox;
        };
    }()),
    computeGeometryPlanes(geometry, matrix, allPlanes = []) {
        if (!geometry.isBufferGeometry) {
            geometry = new THREE.BufferGeometry().fromGeometry(geometry);
        } else {
            geometry = geometry.clone();
        }
        geometry.applyMatrix(matrix);

        let baseMode = true;
        let planes = [];
        let areas = [];
        let supportVolumes = [];
        // if allPlanes provided, then do not add new planes into planes
        // this can speed up geometry computing
        if (allPlanes.length) {
            baseMode = false;
            planes = [...allPlanes];
            areas = new Array(planes.length).fill(0);
            supportVolumes = new Array(planes.length).fill(0);
        }

        function isSimilarPlanes(p1, p2) {
            return Math.abs(p1.constant - p2.constant) < 0.05
            && p1.normal.angleTo(p2.normal) * 180 / Math.PI < 1;
        }

        const positions = geometry.getAttribute('position').array;
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        const triangle = new THREE.Triangle();
        const plane = new THREE.Plane();
        const tmpVector = new THREE.Vector3();

        for (let i = 0, len = positions.length; i < len; i += 9) {
            a.fromArray(positions, i);
            b.fromArray(positions, i + 3);
            c.fromArray(positions, i + 6);
            triangle.set(a, b, c);
            triangle.getPlane(plane);
            const area = triangle.getArea();
            // skip tiny triangles
            if (area < 0.1) continue;

            if (baseMode) {
                const idx = planes.findIndex(p => isSimilarPlanes(p, plane));
                if (idx !== -1) {
                    areas[idx] += area;
                } else {
                    planes.push(new THREE.Plane().copy(plane));
                    areas.push(area);
                }
            } else {
                // eslint-disable-next-line no-shadow
                for (let idx = 0, len = planes.length; idx < len; idx++) {
                    const targetPlane = planes[idx];
                    const angle = plane.normal.angleTo(targetPlane.normal) * 180 / Math.PI;
                    if (angle < 1 && Math.abs(plane.constant - targetPlane.constant) < 0.05) {
                        areas[idx] += area;
                    } else if (angle < 80) {
                        tmpVector.addVectors(a, b).multiplyScalar(0.5).add(c).multiplyScalar(0.5);
                        const volume = area * Math.cos(angle * Math.PI / 180) * Math.abs(targetPlane.distanceToPoint(tmpVector));
                        supportVolumes[idx] += volume;
                    }
                }
            }
        }

        return { planes, areas, supportVolumes };
    }
};

export default ThreeUtils;
