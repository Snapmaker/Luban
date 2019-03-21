import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import ModelLoader from '../widgets/PrintingVisualizer/ModelLoader';
import ConvexGeometry from '../components/three-extensions/ConvexGeometry';
import cost from './cost';

onmessage = (e) => {
    if (isEmpty(e.data) || isEmpty(e.data.modelPath)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }

    new ModelLoader().load(
        e.data.modelPath,
        (bufferGeometry) => {
            cost.time('Model3dToGeometry.worker');
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

            postMessage({
                status: 'succeed',
                value: {
                    bufferGeometryJson: bufferGeometry.toJSON(),
                    convexBufferGeometryJson: convexBufferGeometry.toJSON()
                }
            });
            cost.timeEnd('Model3dToGeometry.worker');
        },
        (progress) => {
            postMessage({ status: 'progress', value: progress });
        },
        (err) => {
            postMessage({ status: 'err', value: 'Model3d to geometry worker error' });
        }
    );
};
