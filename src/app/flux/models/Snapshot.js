import * as THREE from 'three';
import { DATA_PREFIX, EPSILON } from '../../constants';
import Model from './Model';

/*
function deepCopy(obj) {
    let newObj = null;
    switch (typeof obj) {
        case 'undefined':
            break;
        case 'string':
            // newObj = obj + '';
            newObj = `${obj}`;
            break;
        case 'number':
            newObj = obj - 0;
            break;
        case 'boolean':
            newObj = obj;
            break;
        case 'object':
            if (obj === null) {
                newObj = null;
            } else {
                if (obj instanceof Array) {
                    newObj = [];
                    for (let i = 0; i < obj.length; i++) {
                        newObj.push(deepCopy(obj[i]));
                    }
                } else {
                    newObj = {};
                    // for (const key of obj) {
                    for (const key in obj) {
                        newObj[key] = deepCopy(obj[key]);
                    }
                }
            }
            break;
        default:
            newObj = obj;
            break;
    }
    return newObj;
}
*/

class Snapshot {
    constructor(models) {
        this.data = [];
        for (const model of models) {
            // model.updateMatrix();
            model.meshObject.updateMatrix();
            // console.log('snapshot model ', model);
            this.data.push({
                // Bugfix: deep clone
                // model: model,
                // model: model.clone(),
                model: this.copyModel(model),
                // model: deepCopy(model),
                // matrix: model.matrix.clone()
                matrix: model.meshObject.matrix.clone()
            });
        }
    }


    copyModel(model) {
        if (model.sourceType === '3d') {
            return model;
        }
        // const newModel = JSON.parse(JSON.stringify(model));
        const newModel = new Model(model);
        // const { headerType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, geometry, material,
        //   transformation, config, gcodeConfig, mode, movementMode, printOrder, gcodeConfigPlaceholder } = modelInfo;
        // const { modelID, transformation, config, gcodeConfig, modelObject3D, toolPath, toolPathObj3D } = model;
        const { modelID, transformation, config, gcodeConfig } = model;
        // const { geometry, material, position, rotation, scale, up, uuid } = model.meshObject;
        // const { geometry, material, matrix, uuid } = model.meshObject;
        const { geometry, matrix, uuid } = model.meshObject;
        // const { matrix, uuid } = model.meshObject;
        // const { width, height } = transformation;
        newModel.modelID = modelID;
        // const geometry = new THREE.PlaneGeometry(width, height);
        // newModel.modelObject3D = new THREE.Mesh(geometry, material);
        const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;
        const texture = new THREE.TextureLoader().load(uploadPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        newModel.meshObject = new THREE.Mesh(geometry, material);
        // newModel.meshObject.geometry = new THREE.PlaneGeometry(width, height);
        newModel.modelObject3D = new THREE.Mesh(newModel.meshObject.geometry, material);
        // newModel.meshObject.dispatchEvent(EVENTS.UPDATE);
        newModel.meshObject.add(newModel.modelObject3D);

        newModel.meshObject.applyMatrix(matrix);
        newModel.meshObject.uuid = uuid;

        newModel.transformation = {
            ...transformation
        };
        newModel.config = {
            ...config
        };
        newModel.gcodeConfig = {
            ...gcodeConfig
        };
        /*
        newModel.modelObject3D = {
            ...modelObject3D
            // geometry: modelObject3D.geometry,
            // material: modelObject3D.material,
            // visible: true
        };
        newModel.toolPath = {
            ...toolPath
        };
        newModel.toolPathObj3D = {
            ...toolPathObj3D
            // visible: true
        };
        */
        // newModel.toolPathObj3D && (newModel.toolPathObj3D.visible = false);
        // console.log('model ', model);
        // console.log('newModel ', newModel);
        return newModel;
    }

    // const isEqualObject = (objA, objB) => {
    static isEqualObject(objA, objB) {
        const propsA = Object.getOwnPropertyNames(objA);
        const propsB = Object.getOwnPropertyNames(objB);
        if (propsA.length !== propsB.length) {
            // console.log('AB length ', propsA.length, propsB.length);
            // return false;
        }
        for (let i = 0; i < propsA.length; i++) {
            const pName = propsA[i];
            // ignore list
            // if (pName === 'parent' || pName === 'children' || pName === 'meshObject' || pName === 'canUndo' || pName === 'canRedo' || pName === 'hasModel') {
            if (pName === 'parent' || pName === 'children' || pName === 'canUndo' || pName === 'canRedo' || pName === 'hasModel') {
                continue;
            }
            // if (objA[pName] && objB[pName] && (typeof objA[pName] === 'object') && (typeof objB[pName] === 'object')) {
            // if (['transformation', 'config', 'gcodeConfig'].includes(pName) && objA[pName] && objB[pName]) {
            // console.log('pName ', pName);
            if (['transformation', 'config', 'gcodeConfig', 'meshObject', 'geometry', 'scale', 'rotation'].includes(pName) && objA[pName] && objB[pName]) {
            // if (['transformation', 'config', 'gcodeConfig', 'scale', 'rotation'].includes(pName) && objA[pName] && objB[pName]) {
                // return isEqualObject(objA[pName], objB[pName])
                if (!this.isEqualObject(objA[pName], objB[pName])) {
                    // console.log('nested ', pName, objA[pName], objB[pName]);
                    // console.log('nested ', pName);
                    return false;
                }
            }
            if (objA[pName] !== objB[pName]) {
                // console.log('AB name1 ', pName, objA[pName], objB[pName]);
                return false;
            }
        }
        return true;
    }

    static compareSnapshot(snapshot1, snapshot2) {
        if (snapshot1.data.length !== snapshot2.data.length) {
            return false;
        }
        // todo: the item order should not influence result
        const data1 = snapshot1.data;
        const data2 = snapshot2.data;
        for (let i = 0; i < data1.length; i++) {
            // if (data1[i].model !== data2[i].model || !Snapshot._customCompareMatrix4(data1[i].matrix, data2[i].matrix)) {
            // const eq1 = this.isEqualObject(data1[i].model, data2[i].model);
            // console.log('eq1, ', eq1);
            if (!this.isEqualObject(data1[i].model, data2[i].model) || !Snapshot._customCompareMatrix4(data1[i].matrix, data2[i].matrix)) {
                return false;
            }
        }
        return true;
    }

    /**
     * return true if m1 equals m2
     * @param m1
     * @param m2
     * @private
     */
    static _customCompareMatrix4(m1, m2) {
        const arr1 = m1.toArray();
        const arr2 = m2.toArray();
        for (let i = 0; i < arr1.length; i++) {
            if (Math.abs(arr1[i] - arr2[i]) > EPSILON) {
                return false;
            }
        }
        return true;
    }
}

export default Snapshot;
