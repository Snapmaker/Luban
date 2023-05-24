import { ConvexGeometry } from '@snapmaker/luban-platform';
import { Observable } from 'rxjs';
import { BufferGeometry, Group, Vector3 } from 'three';

import ThreeUtils from '../scene/three-extensions/ThreeUtils';
import ModelLoader from '../ui/widgets/PrintingVisualizer/ModelLoader';

const loadModel = (uploadPath: string) => {
    return new Observable((observer) => {
        new ModelLoader().load(
            uploadPath,
            (geometry: BufferGeometry | Group) => {
                // Rotate x by 90 degrees
                // geometry.rotateX(-Math.PI / 2);
                let box3;
                if (geometry instanceof Group) {
                    geometry.children.forEach(mesh => {
                        mesh.geometry.computeBoundingBox();
                        const boundingBox = mesh.geometry.boundingBox;
                        const position = {
                            x: (boundingBox.max.x + boundingBox.min.x) / 2,
                            y: (boundingBox.max.y + boundingBox.min.y) / 2,
                            z: (boundingBox.max.z + boundingBox.min.z) / 2,
                        };
                        mesh.position.set(position.x, position.y, position.z);
                        mesh.geometry.translate(-position.x, -position.y, -position.z);
                    });
                    box3 = ThreeUtils.computeBoundingBox(geometry);
                } else {
                    // Translate model by x:[-a, a]  z:[-b, b]  y:[-c, c], which center the model at zero
                    geometry.computeBoundingBox();
                    box3 = geometry.boundingBox;
                }
                const originalPosition = {
                    x: (box3.max.x + box3.min.x) / 2,
                    y: (box3.max.y + box3.min.y) / 2,
                    z: (box3.max.z + box3.min.z) / 2,
                };
                if (geometry instanceof Group) {
                    observer.next({
                        type: 'LOAD_GROUP_POSITIONS',
                        originalPosition
                    });
                } else {
                    geometry.translate(
                        -originalPosition.x,
                        -originalPosition.y,
                        -originalPosition.z
                    );
                    // Send positions back to caller
                    const positions = geometry.getAttribute('position').array;
                    const byteCountAttribute = geometry.getAttribute('byte_count');
                    // const uvs = geometry.getAttribute('uv')?.array || [];
                    // observer.next({ type: 'LOAD_MODEL_POSITIONS', positions, originalPosition, uvs });
                    observer.next({
                        type: 'LOAD_MODEL_POSITIONS',
                        positions,
                        originalPosition,
                        byteCount: byteCountAttribute ? byteCountAttribute.array : null,
                    });

                    // Calculate convex of model
                    const vertices: Vector3[] = [];
                    for (let i = 0; i < positions.length; i += 3) {
                        vertices.push(
                            new Vector3(
                                positions[i],
                                positions[i + 1],
                                positions[i + 2]
                            )
                        );
                    }

                    const convexGeometry = new ConvexGeometry(vertices);
                    const convexPositions = convexGeometry.getAttribute('position').array;

                    observer.next({
                        type: 'LOAD_MODEL_CONVEX',
                        positions: convexPositions,
                    });
                }
                observer.complete();
            },
            (progress: number) => {
                observer.next({ type: 'LOAD_MODEL_PROGRESS', progress });
            },
            (err: string) => {
                observer.next({ type: 'LOAD_MODEL_FAILED', err });
                observer.complete();
            }
        );
        // });
    });
};

export default loadModel;
