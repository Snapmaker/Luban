import { Observable } from 'rxjs';
import { Matrix4, BufferGeometry, BufferAttribute, Vector3 } from 'three';
import ThreeUtils from '../scene/three-extensions/ThreeUtils';

type ModelInfoData = {
    matrixWorld: Matrix4;
    inverseNormal: boolean;
    convexGeometry: BufferGeometry;
};

type AttributeObject = {
    array: number[];
    itemSize: number;
    normalized: boolean;
};

type AttributeData = {
    send: AttributeObject[];
};

type AutoRotateModelsData = {
    selectedModelInfo: ModelInfoData[];
    positionAttribute: AttributeData;
    normalAttribute: AttributeData;
};

const autoRotateModels = (data: AutoRotateModelsData) => {
    const { selectedModelInfo, positionAttribute, normalAttribute } = data;
    return new Observable((observer) => {
        try {
            const selectedModelLength = selectedModelInfo.length;
            selectedModelInfo.forEach((modelItemInfo, index) => {
                const {
                    matrixWorld,
                    inverseNormal,
                    convexGeometry,
                } = modelItemInfo;
                const geometry = new BufferGeometry();
                const positionObject = positionAttribute.send[index];
                const normalObject = normalAttribute.send[index];
                geometry.setAttribute(
                    'position',
                    new BufferAttribute(
                        positionObject.array,
                        positionObject.itemSize,
                        positionObject.normalized
                    )
                );
                geometry.setAttribute(
                    'normal',
                    new BufferAttribute(
                        normalObject.array,
                        normalObject.itemSize,
                        normalObject.normalized
                    )
                );
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();
                const box3 = geometry.boundingBox;
                const x = (box3.max.x + box3.min.x) / 2;
                const y = (box3.max.y + box3.min.y) / 2;
                const z = (box3.max.z + box3.min.z) / 2;
                const center = new Vector3(x, y, z);
                center.applyMatrix4(matrixWorld);
                const { planes, areas, planesPosition } = ThreeUtils.computeGeometryPlanes(
                    convexGeometry,
                    matrixWorld,
                    [],
                    center,
                    inverseNormal
                );
                const maxArea = Math.max.apply(null, areas);
                const bigPlanes = { planes: null, areas: [], planesPosition: [] };
                bigPlanes.planes = planes.filter((p, idx) => {
                    // filter big planes, 0.1 can be change to improve perfomance
                    const isBig = areas[idx] > maxArea * 0.1;
                    if (isBig) {
                        bigPlanes.areas.push(areas[idx]);
                        bigPlanes.planesPosition.push(planesPosition[idx]);
                    }
                    return isBig;
                });
                if (!bigPlanes.planes.length) {
                    observer.next({
                        status: 'PROGRESS',
                        value: {
                            progress: (index + 1) / (selectedModelLength + 1),
                        },
                    });
                    return;
                }
                const xyPlaneNormal = new Vector3(0, 0, -1);
                const objPlanes = ThreeUtils.computeGeometryPlanes(
                    geometry,
                    matrixWorld,
                    bigPlanes.planes,
                    center,
                    false
                );
                let targetPlane;
                const minSupportVolume = Math.min.apply(
                    null,
                    objPlanes.supportVolumes
                );
                const rates = [];
                if (minSupportVolume < 1) {
                    const idx = objPlanes.supportVolumes.findIndex(
                        (i) => i === minSupportVolume
                    );
                    targetPlane = objPlanes.planes[idx];
                }
                for (
                    let idx = 0, len = bigPlanes.planes.length;
                    idx < len;
                    idx++
                ) {
                    // update rate formula to improve performance
                    const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
                    let supportVolumesFactor = 0;
                    if (objPlanes.supportVolumes[idx] !== 0) {
                        supportVolumesFactor = minSupportVolume
                            / objPlanes.supportVolumes[idx];
                    } else if (minSupportVolume === 0) {
                        supportVolumesFactor = 1;
                    }
                    rates.push(
                        objPlanes.areas[idx]
                        * areasFactor
                        * supportVolumesFactor
                    );
                }
                if (!targetPlane) {
                    const maxRate = Math.max.apply(null, rates);
                    const idx = rates.findIndex((r) => r === maxRate);
                    targetPlane = bigPlanes.planes[idx];
                }
                observer.next({
                    status: 'PARTIAL_SUCCESS',
                    value: {
                        progress:
                            selectedModelLength === 1
                                ? 0.8
                                : (index + 1) / (selectedModelLength + 1),
                        targetPlane: targetPlane.normal,
                        xyPlaneNormal,
                        index,
                        isFinish: index + 1 >= selectedModelLength,
                        rates: rates,
                        planes: objPlanes.planes,
                        planesPosition: bigPlanes.planesPosition,
                        areas: objPlanes.areas,
                        supportVolumes: objPlanes.supportVolumes
                    }
                });
                index + 1 >= selectedModelLength && observer.complete();
            });
        } catch (err) {
            observer.next({ status: 'ERROR', value: err });
            observer.complete();
        }
    });
};

export default autoRotateModels;
