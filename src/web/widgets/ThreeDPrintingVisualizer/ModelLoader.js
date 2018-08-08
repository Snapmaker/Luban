import * as THREE from 'three';
import path from 'path';

const SUPPORT_FORMATS = ['.stl', '.obj'];

class ModelLoader {
    load (modelPath, onLoad, onProgress, onError) {
        const format = path.extname(modelPath).toString().toLowerCase();
        if (!ModelLoader.isFormatSupport(format)) {
            onError('Unsupported format');
            return;
        }
        if (format === '.stl') {
            this.parseAsStl(modelPath, onLoad, onProgress, onError);
        } else if (format === '.obj') {
            this.parseAsObj(modelPath, onLoad, onProgress, onError);
        }
    }

    static getSupportFormats () {
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
        new THREE.STLLoader().load(
            modelPath,
            (geometry) => {
                geometry.computeVertexNormals();
                geometry.normalizeNormals();
                onLoad(geometry);
            },
            (event) => {
                onProgress(event.loaded / event.total);
            },
            (event) => {
                onError(event);
            }
        );
    }

    parseAsObj(modelPath, onLoad, onProgress, onError) {
        new THREE.OBJLoader().load(
            modelPath,
            // container has several meshes(a mesh is one of line/mesh/point). mesh uses BufferGeometry.
            // need to merge all geometries to one
            // BufferGeometry.merge() can not work:
            // https://stackoverflow.com/questions/36450612/how-to-merge-two-buffergeometries-in-one-buffergeometry-in-three-js
            // so implement merge via Geometry
            (container) => {
                const geometry = new THREE.Geometry();
                container.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry && child.geometry instanceof THREE.BufferGeometry) {
                            const ge = new THREE.Geometry();
                            ge.fromBufferGeometry(child.geometry);
                            geometry.merge(ge);
                        }
                    }
                });
                // BufferGeometry is an efficient alternative to Geometry
                const bufferGeometry = new THREE.BufferGeometry();
                bufferGeometry.fromGeometry(geometry);
                onLoad(geometry, modelPath);
            },
            (event) => {
                onProgress(event.loaded / event.total);
            },
            (event) => {
                onError(event);
            }
        );
    }
}

export default ModelLoader;
