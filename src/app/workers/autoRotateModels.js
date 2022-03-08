import * as THREE from 'three';
import ThreeUtils from '../three-extensions/ThreeUtils';
import sendMessage from './utils/sendMessage';

const autoRotateModels = async (data) => {
    try {
        const { selectedModelInfo } = data;
        const selectedModelLength = selectedModelInfo.length;
        selectedModelInfo.forEach((modelItemInfo, index) => {
            const { geometryJSON, matrixWorld, inverseNormal, convexGeometry } = modelItemInfo;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geometryJSON.data.attributes.position.array), geometryJSON.data.attributes.position.itemSize, geometryJSON.data.attributes.position.normalized));
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometryJSON.data.attributes.normal.array), geometryJSON.data.attributes.normal.itemSize, geometryJSON.data.attributes.normal.normalized));
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            const box3 = geometry.boundingBox;
            const x = (box3.max.x + box3.min.x) / 2;
            const y = (box3.max.y + box3.min.y) / 2;
            const z = (box3.max.z + box3.min.z) / 2;
            const center = new THREE.Vector3(x, y, z);
            center.applyMatrix4(matrixWorld);

            const { planes, areas } = ThreeUtils.computeGeometryPlanes(convexGeometry, matrixWorld, [], center, inverseNormal);
            const maxArea = Math.max.apply(null, areas);
            const bigPlanes = { planes: null, areas: [] };
            bigPlanes.planes = planes.filter((p, idx) => {
                // filter big planes, 0.1 can be change to improve perfomance
                const isBig = areas[idx] > maxArea * 0.1;
                isBig && bigPlanes.areas.push(areas[idx]);
                return isBig;
            });

            if (!bigPlanes.planes.length) {
                sendMessage({ status: 'progress', value: { progress: (index + 1) / (selectedModelLength + 1) } });
                return;
            }
            const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
            const objPlanes = ThreeUtils.computeGeometryPlanes(geometry, matrixWorld, bigPlanes.planes, center, false);
            let targetPlane;
            const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);
            if (minSupportVolume < 1) {
                const idx = objPlanes.supportVolumes.findIndex(i => i === minSupportVolume);
                targetPlane = objPlanes.planes[idx];
            }
            if (!targetPlane) {
                const rates = [];
                for (let idx = 0, len = bigPlanes.planes.length; idx < len; idx++) {
                    // update rate formula to improve performance
                    const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
                    let supportVolumesFactor = 0;
                    if (objPlanes.supportVolumes[idx] !== 0) {
                        supportVolumesFactor = minSupportVolume / objPlanes.supportVolumes[idx];
                    } else if (minSupportVolume === 0) {
                        supportVolumesFactor = 1;
                    }
                    rates.push(objPlanes.areas[idx] * areasFactor * supportVolumesFactor);
                }

                const maxRate = Math.max.apply(null, rates);
                const idx = rates.findIndex(r => r === maxRate);
                targetPlane = bigPlanes.planes[idx];
            }
            sendMessage({
                status: 'PARTIAL_SUCCESS',
                value: {
                    progress: (index + 1) / (selectedModelLength + 1),
                    targetPlane: targetPlane.normal,
                    xyPlaneNormal,
                    index,
                    isFinish: index + 1 >= selectedModelLength
                }
            });
        });
    } catch (err) {
        sendMessage({ status: 'ERROR', value: err });
        console.log({ err });
    }
};

export default autoRotateModels;
