import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import ModelExporter from '../widgets/PrintingVisualizer/ModelExporter';


onmessage = (e) => {
    if (isEmpty(e.data)) {
        postMessage({ status: 'err', value: 'Data is empty' });
        return;
    }

    const { modelGroupJson, format, isBinary = true } = e.data;
    if (isEmpty(modelGroupJson)) {
        postMessage({ status: 'err', value: 'ModelGroup is empty' });
        return;
    }

    if (!['stl', 'obj'].includes(format)) {
        postMessage({ status: 'err', value: 'Unsupported format: ' + format });
        return;
    }

    let modelGroup;
    new THREE.ObjectLoader().parse(modelGroupJson, (mObj3d) => {
        modelGroup = mObj3d;
    });
    const output = new ModelExporter().parse(modelGroup, format, isBinary);
    postMessage({ status: 'succeed', value: output });
};
