
import * as THREE from 'three';

function generateSupportBoxGeometry(width, height, topZ, bottomZ = 0) {
    const depth = topZ - bottomZ;
    const box = new THREE.BoxBufferGeometry(width, height, depth).toNonIndexed();
    box.translate(0, 0, depth / 2 + bottomZ);
    return box;
}

export default {
    // set overhang points' color
    // todo: can add progress and complete callback
    indexModelAsync(model, onComplete) {
        model.meshObject.updateMatrixWorld();
        const bufferGeometry = model.meshObject.geometry;
        const clone = bufferGeometry.clone();
        clone.applyMatrix(model.meshObject.matrixWorld.clone());

        const positions = clone.getAttribute('position').array;

        const colors = [];
        const normals = clone.getAttribute('normal').array;
        let start = 0;
        function worker() {
            let i = start;
            do {
                const normal = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);
                const angle = normal.angleTo(new THREE.Vector3(0, 0, 1)) / Math.PI * 180;
                const avgZ = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;

                if (angle > 120 && avgZ > 1) {
                    colors.push(1, 0.2, 0.2);
                    colors.push(1, 0.2, 0.2);
                    colors.push(1, 0.2, 0.2);
                } else {
                    colors.push(0.9, 0.9, 0.9);
                    colors.push(0.9, 0.9, 0.9);
                    colors.push(0.9, 0.9, 0.9);
                }
                i += 9;
            } while (i - start < 10000 && i < normals.length);
            if (i < normals.length) {
                start = i;
                setTimeout(worker, 1);
            } else {
                bufferGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                // model.gData = gData;
                model.setSelected();
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }

        setTimeout(worker, 10);
    },

    generateSupportGeometry(model) {
        const target = model.target;
        model.computeBoundingBox();
        const bbox = model.boundingBox;
        const center = new THREE.Vector3(bbox.min.x + (bbox.max.x - bbox.min.x) / 2, bbox.min.y + (bbox.max.y - bbox.min.y) / 2, 0);

        const rayDirection = new THREE.Vector3(0, 0, 1);
        const size = model.supportSize;
        const raycaster = new THREE.Raycaster(center, rayDirection);
        const intersect = raycaster.intersectObject(target.meshObject, true)[0];
        model.isInitSupport = true;
        let height = 100;
        if (intersect && intersect.distance > 0) {
            model.isInitSupport = false;
            height = intersect.point.z;
        }
        const geometry = generateSupportBoxGeometry(size.x, size.y, height);

        geometry.computeVertexNormals();

        model.meshObject.geometry = geometry;
        model.computeBoundingBox();
    }
};
