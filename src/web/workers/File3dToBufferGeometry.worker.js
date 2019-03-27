import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import ModelLoader from '../widgets/PrintingVisualizer/ModelLoader';
import ConvexGeometry from '../components/three-extensions/ConvexGeometry';

onmessage = (e) => {
    if (isEmpty(e.data) || isEmpty(e.data.modelPath)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }

    new ModelLoader().load(
        e.data.modelPath,
        (bufferGeometry) => {
            postMessage({ status: 'progress', value: 0.9 });

            // step-1: rotate x 90 degree
            bufferGeometry.rotateX(-Math.PI / 2);

            // step-2: make to x:[-a, a]  z:[-b, b]  y:[-c, c]
            bufferGeometry.computeBoundingBox();
            const box3 = bufferGeometry.boundingBox;
            let x = -(box3.max.x + box3.min.x) / 2;
            let y = -(box3.max.y + box3.min.y) / 2;
            let z = -(box3.max.z + box3.min.z) / 2;
            bufferGeometry.translate(x, y, z);

            // for more effective: ConvexGeometry called mergeVertices to reduce vertices
            // example: 12M binary stl, vertices count 12w -> 2w
            const tempGeometry = new THREE.Geometry().fromBufferGeometry(bufferGeometry);
            const convexGeometry = new ConvexGeometry(tempGeometry.vertices);
            const convexBufferGeometry = new THREE.BufferGeometry();
            convexBufferGeometry.fromGeometry(convexGeometry);

            const modelPositions = bufferGeometry.getAttribute('position').array;
            const modelConvexPositions = convexBufferGeometry.getAttribute('position').array;
            const data = {
                status: 'succeed',
                value: {
                    modelPositions,
                    modelConvexPositions
                }
            };
            postMessage(
                data,
                [modelPositions.buffer, modelConvexPositions.buffer]
            );
        },
        (progress) => {
            postMessage({ status: 'progress', value: progress / 2 });
        },
        (err) => {
            postMessage({ status: 'err', value: 'Model3d to geometry worker error' });
        }
    );
};
