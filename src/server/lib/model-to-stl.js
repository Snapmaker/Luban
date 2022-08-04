import path from 'path';
import fs from 'fs';
import { MeshBasicMaterial, Mesh } from 'three';
import { v4 as uuid } from 'uuid';
import AMFLoader from '../../shared/lib/AMFLoader';
import ThreeMFLoader from '../../shared/lib/3MFLoader';
import STLExporter from '../../shared/lib/STL/STLExporter';
import { BufferGeometryUtils } from '../../shared/lib/BufferGeometryUtils';
import DataStorage from '../DataStorage';
import { removeSpecialChars } from '../../shared/lib/utils';
import { generateRandomPathName } from '../../shared/lib/random-utils';

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
function loadModel(file, format, separateGroup, Loader) {
    return new Promise((resolve, reject) => {
        const buffer = fs.readFileSync(path.resolve(file.path));
        const uint8Arr = new Uint8Array(buffer.byteLength);
        buffer.copy(uint8Arr, 0, 0, buffer.byteLength);

        new Loader().loadFromBuffer(uint8Arr.buffer, (group) => {
            let filename = file.name;
            let filePath = file.path;
            const children = [];
            // merge all the meshes in group
            flatGroup(group);
            if (separateGroup) {
                const bufferGeometrys = group.children.slice(0).map(mesh => {
                    mesh.geometry.deleteAttribute('uv');
                    return mesh.geometry;
                });
                bufferGeometrys.forEach((item) => {
                    const mesh = new Mesh(item, new MeshBasicMaterial());
                    let partFilename = removeSpecialChars(path.basename(filename));
                    partFilename = generateRandomPathName(partFilename);
                    partFilename = partFilename.replace(new RegExp(`.${format}$`, 'ig'), '_.stl');
                    const partFilePath = `${DataStorage.tmpDir}/${partFilename}`;
                    fs.writeFileSync(partFilePath, new STLExporter().parse(mesh, { binary: true }), 'utf8');
                    children.push({
                        uploadName: partFilename,
                        modelID: uuid()
                    });
                });
            } else {
                filename = file.name.replace(new RegExp(`.${format}$`, 'ig'), '.stl');
                filePath = `${DataStorage.tmpDir}/${filename}`;
                const bufferGeometry = BufferGeometryUtils.mergeBufferGeometries(group.children.slice(0).map(mesh => {
                    mesh.geometry.deleteAttribute('uv');
                    return mesh.geometry;
                }), false);
                const mesh = new Mesh(bufferGeometry, new MeshBasicMaterial());
                fs.writeFileSync(filePath, new STLExporter().parse(mesh, { binary: true }), 'utf8');
            }
            resolve({
                filename,
                filePath,
                children
            });
        }, (error) => {
            reject(error);
        });
    });
}
function convertFileToSTL(file, separateGroup = false) {
    return new Promise((resolve, reject) => {
        if (file.name.toLowerCase().endsWith('.amf')) {
            loadModel(file, 'amf', separateGroup, AMFLoader).then(resolve).catch(reject);
        } else if (file.name.toLowerCase().endsWith('.3mf')) {
            loadModel(file, '3mf', separateGroup, ThreeMFLoader).then(resolve).catch(reject);
        } else {
            resolve({
                filename: file.name,
                filePath: file.path
            });
        }
    });
}

export {
    convertFileToSTL
};
