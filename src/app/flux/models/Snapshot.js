import { EPSILON } from '../../constants';

class Snapshot {
    constructor(models) {
        this.data = [];
        for (const model of models) {
            // model.updateMatrix();
            model.meshObject.updateMatrix();
            this.data.push({
                // Bugfix: deep clone
                // model: model,
                model: model.clone(),
                // matrix: model.matrix.clone()
                matrix: model.meshObject.matrix.clone()
            });
        }
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
            if (pName === 'parent' || pName === 'children' || pName === 'meshObject' || pName === 'canUndo' || pName === 'canRedo' || pName === 'hasModel') {
                continue;
            }
            // TODO Should enumerate?
            // if (objA[pName] && objB[pName] && (typeof objA[pName] === 'object') && (typeof objB[pName] === 'object')) {
            if (['transformation', 'config', 'gcodeConfig'].includes(pName) && objA[pName] && objB[pName]) {
                // return isEqualObject(objA[pName], objB[pName]);
                if (!this.isEqualObject(objA[pName], objB[pName])) {
                    console.log('nested ', pName, objA[pName], objB[pName]);
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
