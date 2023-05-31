import { Camera, MOUSE, Object3D, Raycaster } from 'three';

import Control, { Pointer } from '../../ui/components/SMCanvas/Control';


const _raycaster = new Raycaster();

export default class MeshColoringControl extends Control {
    private mode: string = 'mesh-coloring';

    private targetObject: Object3D = null;

    public constructor(camera: Camera) {
        super(camera);

        this.name = 'MeshColoringControl';
    }

    public setTargetObject(object: Object3D): void {
        this.targetObject = object;
    }

    public isActive(mode: string): boolean {
        return mode === this.mode;
    }

    public onPointerDown(pointer: Pointer): boolean {
        switch (pointer.button) {
            case MOUSE.LEFT: {
                _raycaster.setFromCamera(pointer, this.camera);
                _raycaster.firstHitOnly = true;

                const res = _raycaster.intersectObject(this.targetObject, true);
                if (res.length) {
                    console.log('hit!');
                    return true;
                }
                break;
            }
            default:
                break;
        }

        return false;
    }
}
