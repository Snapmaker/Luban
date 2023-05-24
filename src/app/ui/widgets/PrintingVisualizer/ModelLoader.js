import * as THREE from 'three';
import path from 'path';
import AMFLoader from '../../../../shared/lib/AMFLoader';
import ThreeMFLoader from '../../../../shared/lib/3MFLoader';
import STLLoader from '../../../scene/three-extensions/STLLoader';
import OBJLoader from '../../../scene/three-extensions/OBJLoader';

const SUPPORT_FORMATS = ['.stl', '.obj', '.amf', '.3mf'];

// make meshs into the same group
function flatGroup(object) {
    if (!object.isGroup) { // mesh
        if (object.parent) {
            object.name += object.parent.name;
            object.updateMatrixWorld();
            object.geometry.applyMatrix4(object.matrixWorld);
            object.applyMatrix4(object.matrixWorld.clone().invert());
            if (object.geometry.index) {
                object.geometry = object.geometry.toNonIndexed();
            }
        }
    } else {
        for (let i = object.children.length - 1; i > -1; i--) {
            const child = object.children[i];
            flatGroup(child);
        }
        if (object.parent && object.parent.isGroup) {
            if (object.children.length > 0) {
                object.parent.add(...object.children);
            }
            object.parent.remove(object);
        }
    }
}

class ModelLoader {
    load(modelPath, onLoad, onProgress, onError) {
        // to fix bug: get firstly uploaded model when load different files with the same filename
        THREE.Cache.clear();
        const format = path.extname(modelPath).toString().toLowerCase();
        if (!ModelLoader.isFormatSupport(format)) {
            onError('Unsupported format');
            return;
        }
        switch (format) {
            case '.stl':
                this.parseAsStl(modelPath, onLoad, onProgress, onError);
                break;
            case '.obj':
                this.parseAsObj(modelPath, onLoad, onProgress, onError);
                break;
            case '.3mf':
                this.parseAs3mf(modelPath, onLoad, onProgress, onError);
                break;
            case '.amf':
                this.parseAsAmf(modelPath, onLoad, onProgress, onError);
                break;
            default:
                break;
        }
    }

    static getSupportFormats() {
        return SUPPORT_FORMATS;
    }

    static isFormatSupport(format) {
        for (const item of SUPPORT_FORMATS) {
            if (item === format.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    parseAsStl(modelPath, onLoad, onProgress, onError) {
        new STLLoader().load(
            modelPath,
            (geometry) => {
                // call the following if lost reflection
                // geometry.computeVertexNormals();
                // geometry.normalizeNormals();
                onLoad(geometry);
            },
            (progress) => {
                onProgress(progress);
            },
            (event) => {
                onError(event);
            }
        );
    }

    parseAsObj(modelPath, onLoad, onProgress, onError) {
        new OBJLoader().load(
            modelPath,
            // container has several meshes(a mesh is one of line/mesh/point). mesh uses BufferGeometry.
            // need to merge all geometries to one
            // BufferGeometry.merge() can not work:
            // https://stackoverflow.com/questions/36450612/how-to-merge-two-buffergeometries-in-one-buffergeometry-in-three-js
            // so implement merge via Geometry
            (container) => {
                // let geometry = new THREE.Geometry();
                let geometry = null;
                if (container.children.length) {
                    container.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (!geometry) {
                                geometry = new THREE.Geometry();
                            }
                            if (child.geometry && child.geometry instanceof THREE.BufferGeometry && geometry) {
                                const ge = new THREE.Geometry();
                                ge.fromBufferGeometry(child.geometry);
                                geometry.merge(ge);
                            }
                        }
                    });
                    // BufferGeometry is an efficient alternative to Geometry
                    // const bufferGeometry = new THREE.BufferGeometry();
                    let bufferGeometry = null;
                    if (geometry) {
                        bufferGeometry = new THREE.BufferGeometry();
                        bufferGeometry.fromGeometry(geometry);
                    }
                    // call the following if lost reflection
                    // bufferGeometry.computeVertexNormals();
                    // bufferGeometry.normalizeNormals();
                    onLoad(bufferGeometry);
                } else {
                    onError({
                        msg: 'Failed to import this object. Please select a supported file format.'
                    });
                }
            },
            (progress) => {
                onProgress(progress);
            },
            (event) => {
                onError(event);
            }
        );
    }

    parseAs3mf(modelPath, onLoad, onProgress, onError) {
        new ThreeMFLoader().load(
            modelPath,
            (group) => {
                flatGroup(group);
                onLoad(group);
            },
            (progress) => {
                onProgress(progress);
            },
            (error) => {
                onError(error);
            }
        );
    }

    parseAsAmf(modelPath, onLoad, onProgress, onError) {
        new AMFLoader().load(
            modelPath,
            (group) => {
                flatGroup(group);
                onLoad(group);
            },
            (progress) => {
                onProgress(progress);
            },
            (error) => {
                onError(error);
            }
        );
    }
}

export default ModelLoader;
