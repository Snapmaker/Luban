import * as THREE from 'three';
import { Matrix4, MathUtils } from 'three';
import { Observable } from 'rxjs';
import ThreeUtils from '../scene/three-extensions/ThreeUtils';

type Vector3Number = {
    x: number;
    y: number;
    z: number;
};

type PositionItemData = {
    itemSize: number;
    array: Float32Array;
};

type ScaleToFitData = {
    size: Vector3Number;
    positionAttribute: object;
    normalAttribute: object;
    matrixWorlds: object;
    left: number;
    right: number;
    front: number;
    back: number;
    selectedGroupMatrix: Matrix4;
    selectedCount: number;
};
function scaleToFitWithRotate(data: ScaleToFitData) {
    return new Observable((observer) => {
        try {
            const tempSelectedGroup = new THREE.Group();
            const {
                positionAttribute,
                normalAttribute,
                matrixWorlds,
                left,
                right,
                front,
                back,
                selectedGroupMatrix,
                selectedCount,
            } = data;
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
                z: size.z,
            };
            observer.next({
                status: 'UPDATE_PROGRESS',
                value: {
                    progress: 0.25,
                },
            });
            positionAttribute.send.forEach(
                (positionItem: PositionItemData, index: number) => {
                    const tempGeometry = new THREE.BufferGeometry();
                    tempGeometry.setAttribute(
                        'position',
                        new THREE.BufferAttribute(
                            positionItem.array,
                            positionItem.itemSize
                        )
                    );
                    tempGeometry.setAttribute(
                        'normal',
                        new THREE.BufferAttribute(
                            normalAttribute.send[index].array,
                            normalAttribute.send[index].itemSize
                        )
                    );
                    const meshObject = new THREE.Mesh(
                        tempGeometry,
                        new THREE.MeshMatcapMaterial({ color: 0xffffff })
                    );
                    meshObject.applyMatrix4(matrixWorlds.send[index]);
                    ThreeUtils.applyObjectMatrix(
                        tempSelectedGroup,
                        new THREE.Matrix4()
                            .copy(tempSelectedGroup.matrix)
                            .invert()
                    );
                    ThreeUtils.setObjectParent(meshObject, tempSelectedGroup);
                }
            );
            selectedCount > 1
                && tempSelectedGroup.applyMatrix4(selectedGroupMatrix);
            const whd = new THREE.Vector3();
            ThreeUtils.computeBoundingBox(tempSelectedGroup).getSize(whd);
            for (let i = 0; i < 19; i++) {
                tempSelectedGroup.rotation.z = MathUtils.degToRad(i * 10);
                tempSelectedGroup.updateMatrix();
                ThreeUtils.computeBoundingBox(tempSelectedGroup).getSize(whd);
                const scalar = ['x', 'y', 'z'].reduce(
                    (prev, key) => Math.min((size[key] - 5) / whd[key], prev),
                    Number.POSITIVE_INFINITY
                );
                rotateAngel = scalar > maxScale ? i * 10 : rotateAngel;
                maxScale = scalar > maxScale ? scalar : maxScale;
                observer.next({
                    status: 'UPDATE_PROGRESS',
                    value: {
                        progress: (((i + 1) * 75) / 19 + 25) / 100,
                    },
                });
            }
            observer.next({
                status: 'FINISH',
                value: {
                    maxScale: Math.round(maxScale * 1000) / 1000,
                    rotateAngel,
                    offsetX,
                },
            });
            observer.complete();
        } catch (err) {
            observer.next({
                status: 'ERR',
                value: err,
            });
            observer.complete();
        }
    });
}

export default scaleToFitWithRotate;
