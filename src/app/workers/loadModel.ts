import * as THREE from 'three';
import { BufferGeometry } from 'three';
import { Observable } from 'rxjs';
import ModelLoader from '../ui/widgets/PrintingVisualizer/ModelLoader';
import ConvexGeometry from '../three-extensions/ConvexGeometry';

const loadModel = (uploadPath: string) => {
    return new Observable((observer) => {
        new ModelLoader().load(
            uploadPath,
            (geometry: BufferGeometry) => {
                // Rotate x by 90 degrees
                // geometry.rotateX(-Math.PI / 2);

                // Translate model by x:[-a, a]  z:[-b, b]  y:[-c, c], which center the model at zero
                geometry.computeBoundingBox();
                const box3 = geometry.boundingBox;
                const originalPosition = {
                    x: (box3.max.x + box3.min.x) / 2,
                    y: (box3.max.y + box3.min.y) / 2,
                    z: (box3.max.z + box3.min.z) / 2,
                };
                geometry.translate(
                    -originalPosition.x,
                    -originalPosition.y,
                    -originalPosition.z
                );
                // Send positions back to caller
                const positions = geometry.getAttribute('position').array;
                // const uvs = geometry.getAttribute('uv')?.array || [];
                // observer.next({ type: 'LOAD_MODEL_POSITIONS', positions, originalPosition, uvs });
                observer.next({
                    type: 'LOAD_MODEL_POSITIONS',
                    positions,
                    originalPosition,
                });

                // Calculate convex of model
                const vertices = [];
                for (let i = 0; i < positions.length; i += 3) {
                    vertices.push(
                        new THREE.Vector3(
                            positions[i],
                            positions[i + 1],
                            positions[i + 2]
                        )
                    );
                }
                const convexGeometry = new ConvexGeometry(vertices) as any;
                const convexBufferGeometry = new THREE.BufferGeometry().fromGeometry(
                    convexGeometry
                );
                const convexPositions = convexBufferGeometry.getAttribute(
                    'position'
                ).array;
                observer.next({
                    type: 'LOAD_MODEL_CONVEX',
                    positions: convexPositions,
                });
            },
            (progress: number) => {
                observer.next({ type: 'LOAD_MODEL_PROGRESS', progress });
            },
            (err: string) => {
                observer.next({ type: 'LOAD_MODEL_FAILED', err });
            }
        );
        // });
    });
};

export default loadModel;
