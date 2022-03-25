import * as THREE from 'three';
import sendMessage from './utils/sendMessage';
import ThreeUtils from '../three-extensions/ThreeUtils';

const scaleToFitWithRotate = ({ data }) => {
    try {
        const tempSelectedGroup = new THREE.Group();
        // const { meshObjectJSON: { geometries }, left, right, front, back } = data;
        const { meshObjectJSON, left, right, front, back, selectedGroupMatrix } = data;
        let { size } = data;
        let offsetX = 0;
        let maxScale = -1;
        let rotateAngel = 0;
        if (left !== right) {
            const originCenter = size.x / 2;
            const currentCenter = (size.x - right) / 2 + left / 2;
            offsetX = currentCenter - originCenter;
        } else {
            offsetX = 0;
        }
        size = {
            x: size.x - left - right,
            y: size.y - front - back,
            z: size.z
        };
        sendMessage({
            status: 'UPDATE_PROGRESS',
            value: {
                progress: 0.25
            }
        });
        meshObjectJSON.forEach(meshObjectItem => {
            const tempGeometry = new THREE.BufferGeometry();
            tempGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meshObjectItem.data.attributes.position.array), meshObjectItem.data.attributes.position.itemSize, meshObjectItem.data.attributes.position.normalized));
            tempGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(meshObjectItem.data.attributes.normal.array), meshObjectItem.data.attributes.normal.itemSize, meshObjectItem.data.attributes.normal.normalized));
            const meshObject = new THREE.Mesh(tempGeometry, new THREE.MeshMatcapMaterial({ color: 0xffffff }));
            meshObject.applyMatrix4(meshObjectItem.modelItemMatrix);
            ThreeUtils.applyObjectMatrix(tempSelectedGroup, new THREE.Matrix4().copy(tempSelectedGroup.matrix).invert());
            ThreeUtils.setObjectParent(meshObject, tempSelectedGroup);
        });
        tempSelectedGroup.applyMatrix4(selectedGroupMatrix);
        const whd = new THREE.Vector3();
        ThreeUtils.computeBoundingBox(tempSelectedGroup).getSize(whd);
        for (let i = 0; i < 19; i++) {
            tempSelectedGroup.rotation.z = THREE.Math.degToRad(i * 10);
            tempSelectedGroup.updateMatrix();
            ThreeUtils.computeBoundingBox(tempSelectedGroup).getSize(whd);
            const scalar = ['x', 'y', 'z'].reduce((prev, key) => Math.min((size[key] - 5) / whd[key], prev), Number.POSITIVE_INFINITY);
            rotateAngel = (scalar > maxScale ? i * 10 : rotateAngel);
            maxScale = (scalar > maxScale ? scalar : maxScale);
            sendMessage({
                status: 'UPDATE_PROGRESS',
                value: {
                    progress: ((i + 1) * 75 / 19 + 25) / 100
                }
            });
        }
        sendMessage({
            status: 'FINISH',
            value: {
                maxScale: Math.round(maxScale * 10) / 10,
                rotateAngel,
                offsetX
            }
        });
    } catch (err) {
        console.log('err', err);
        sendMessage({
            status: 'ERR',
            value: err
        });
    }
};

export default scaleToFitWithRotate;
