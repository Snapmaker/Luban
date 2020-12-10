import * as THREE from 'three';

import SupportHelper from '../../lib/support-helper';
import ThreeUtils from '../three-extensions/ThreeUtils';

class SupportControls extends THREE.Object3D {
    camera = null;

    raycaster = new THREE.Raycaster();

    horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    _model = null;

    constructor(camera, removeModel, addSupportOnSelectedModel) {
        super();
        this.camera = camera;
        this.removeModel = removeModel;
        this.addSupportOnSelectedModel = addSupportOnSelectedModel;
    }

    start() {
    }

    stop() {
        if (this._model) {
            this.removeModel(this._model);
            this._model = null;
        }
    }


    setModelPosition(position) {
        if (!this._model) {
            this._model = this.addSupportOnSelectedModel();
        }

        const object = this._model.meshObject;
        object.position.copy(position);
        SupportHelper.generateSupportGeometry(this._model);
        this.dispatchEvent({ type: 'update' });
    }

    onMouseHover(coord) {
        this.raycaster.setFromCamera(coord, this.camera);
        const mousePosition = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.horizontalPlane, mousePosition);
        this.setModelPosition(mousePosition);
    }


    onMouseUp() {
        SupportHelper.generateSupportGeometry(this._model);
        if (this._model.isInitSupport) {
            this.removeModel(this._model);
        } else {
            ThreeUtils.setObjectParent(this._model.meshObject, this._model.target.meshObject);
        }
        this._model = null;
    }
}

export default SupportControls;
