/* eslint-disable */
import * as THREE from 'three';

const ThreeUtils = {
    getQuaternionBetweenVector3: function (v1, v2) {
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
    getRotateMatrixBetweenVector3: function (v1, v2) {
        const quaternion = ThreeUtils.getQuaternionBetweenVector3(v1, v2);
        const matrix4 = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
        return matrix4;
    },

    getMouseXY: function (event, domElement) {
        const rect = domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    },

    // get world info
    getObjectWorldPosition: function (object) {
        const result = new THREE.Vector3();
        object.getWorldPosition(result);
        return result;
    },

    getObjectWorldQuaternion: function (object) {
        const result = new THREE.Quaternion();
        object.getWorldQuaternion(result);
        return result;
    },

    getObjectWorldScale: function (object) {
        const result = new THREE.Vector3();
        object.getWorldScale(result);
        return result;
    },

    getEventWorldPosition: function (event, domElement, camera) {
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
    setObjectWorldPosition: function (object, position) {
        const parent = object.parent;
        parent.updateMatrixWorld();
        const matrix = new THREE.Matrix4().getInverse(parent.matrixWorld);
        position.applyMatrix4(matrix);
        object.position.copy(position);
    },

    setObjectWorldScale: function (object, scale) {
        const localScale = object.parent.worldToLocal(scale);
        object.scale.copy(localScale);
    },

    setObjectWorldQuaternion: function (object, quaternion) {
        object.setRotationFromQuaternion(quaternion);

        const parentQuaternion = ThreeUtils.getObjectWorldQuaternion(object.parent);
        object.applyQuaternion(parentQuaternion.inverse());
    },

    scaleObjectToWorldSize: function (object, targetSize, pivot) {
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

    getGeometrySize: function (geometry, is2D) {
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
    computeBoundingBox: (function () {
        const caches = {};
        const initialBox = new THREE.Box3();
        const tmpMatrix = new THREE.Matrix4();
        return function computeBoundingBox(obj, useCacheGeometry = true) {
            let cache = caches[obj.uuid];
            if (!cache) {
                cache = {
                    geometry: obj.isMesh && obj.geometry.clone(),
                    lastMatrix: new THREE.Matrix4(),
                    lastBbox: new THREE.Box3().copy(initialBox)
                };
                caches[obj.uuid] = cache;
            }
            if(!useCacheGeometry) {
                cache.geometry = obj.geometry.clone();
            }
            const { geometry, lastMatrix, lastBbox } = cache;

            if (obj.isMesh) {
                obj.updateMatrixWorld();
                if (lastBbox.isEmpty() || !lastMatrix.equals(obj.matrixWorld)) {
                    geometry.applyMatrix(obj.matrixWorld);
                    if(!geometry.boundingBox) {
                        geometry.computeBoundingBox();
                    }
                    lastBbox.copy(geometry.boundingBox);
                    lastMatrix.copy(obj.matrixWorld);
                    geometry.applyMatrix(tmpMatrix.getInverse(obj.matrixWorld));
                }
            } else {
                lastBbox.copy(initialBox);
            }

            for (const child of obj.children) {
                const cBBox = ThreeUtils.computeBoundingBox(child, useCacheGeometry);
                if(!cBBox.isEmpty()){
                    lastBbox.expandByPoint(cBBox.min).expandByPoint(cBBox.max);
                }
            }
            return lastBbox;
        };
    }())

};

export default ThreeUtils;
