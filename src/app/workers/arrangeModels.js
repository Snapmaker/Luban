import * as THREE from 'three';
import sendMessage from './utils/sendMessage';
// import ThreeGroup from '../models/ThreeGroup';
import { nesting } from '../../shared/lib/nesting';

const getModelFaces = (model) => { // TODO, move to util
    const min = {
        x: Number.MAX_SAFE_INTEGER,
        y: Number.MAX_SAFE_INTEGER
    };
    const max = {
        x: Number.MIN_SAFE_INTEGER,
        y: Number.MIN_SAFE_INTEGER
    };
    const matrix = model.matrix;
    const {
        array,
        count
    } = model;
    const faces = new Array(count / 3);
    for (let i = 0; i < count / 3; i++) {
        const v0 = (new THREE.Vector3(array[i * 9 + 0], array[i * 9 + 1], array[i * 9 + 2])).applyMatrix4(matrix);
        const v1 = (new THREE.Vector3(array[i * 9 + 3], array[i * 9 + 4], array[i * 9 + 5])).applyMatrix4(matrix);
        const v2 = (new THREE.Vector3(array[i * 9 + 6], array[i * 9 + 7], array[i * 9 + 8])).applyMatrix4(matrix);
        min.x = Math.min(min.x, v0.x, v1.x, v2.x);
        min.y = Math.min(min.y, v0.y, v1.y, v2.y);
        max.x = Math.max(max.x, v0.x, v1.x, v2.x);
        max.y = Math.max(max.y, v0.y, v1.y, v2.y);
        faces[i] = [
            { x: v0.x, y: v0.y },
            { x: v1.x, y: v1.y },
            { x: v2.x, y: v2.y }
        ];
    }
    return { faces, min, max };
};

const arrangeModels = async (data) => {
    try {
        const {
            models = [],
            // modelsNotArranged = [],
            validArea, angle, offset, padding, memory
        } = data;

        let memoryCount = 0;
        const stls = [];
        models.forEach((model) => {
            sendMessage({ status: 'progress', value: { progress: (models.indexOf(model) / models.length / 2) } });
            let faces = [];
            let stlBoundingBox = {
                min: {
                    x: Number.MAX_SAFE_INTEGER,
                    y: Number.MAX_SAFE_INTEGER
                },
                max: {
                    x: Number.MIN_SAFE_INTEGER,
                    y: Number.MIN_SAFE_INTEGER
                }
            };

            let length = 0, indexFaces = 0;
            model.children.forEach((child) => {
                const {
                    count
                } = child;
                length += count / 3;
            });
            faces = new Array(length);
            model.children.forEach((child) => {
                memoryCount += child.count * 8 * 8;
                if (memoryCount > memory) {
                    stls.forEach(stl => {
                        stl.faces = [];
                        stl = null;
                    });
                    throw new Error('MLE');
                }
                const { faces: modelFaces, min, max } = getModelFaces(child);
                modelFaces.forEach((face) => {
                    faces[indexFaces] = face;
                    indexFaces += 1;
                });
                stlBoundingBox = {
                    min: {
                        x: Math.min(stlBoundingBox.min.x, min.x),
                        y: Math.min(stlBoundingBox.min.y, min.y)
                    },
                    max: {
                        x: Math.max(stlBoundingBox.max.x, max.x),
                        y: Math.max(stlBoundingBox.max.y, max.y)
                    }
                };
            });

            stls.push({
                faces,
                modelID: model.modelID,
                boundingBox: stlBoundingBox,
                center: model.center
            });
        });

        const x = validArea.max.x - validArea.min.x - padding * 2 + offset;
        const y = validArea.max.y - validArea.min.y - padding * 2 + offset;
        const parts = nesting(stls, {
            size: {
                x: x < 0 ? 0 : x,
                y: y < 0 ? 0 : y
            },
            angle,
            offset
        }, (progress) => {
            sendMessage({ status: 'progress', value: { progress } });
        });

        stls.forEach(stl => {
            stl.faces = [];
            stl = null;
        });
        sendMessage({ status: 'succeed', value: { parts } });
    } catch (err) {
        console.log('err', err);
        sendMessage({ status: 'err', value: err });
    }
};

export default arrangeModels;
