import { Camera, Color, MOUSE, Object3D, Raycaster } from 'three';

import Control, { Pointer } from '../../ui/components/SMCanvas/Control';
import ModelGroup from '../../models/ModelGroup';


const _raycaster = new Raycaster();
_raycaster.params.Line.threshold = 0.5;

export default class MeshColoringControl extends Control {
    private mode: string = 'mesh-coloring';

    private modelGroup: ModelGroup;
    private isPointerDown: boolean = false;

    private targetObject: Object3D = null;

    private faceExtruderMark: number;
    private faceColor: Color | null = null;


    public constructor(camera: Camera, modelGroup: ModelGroup) {
        super(camera);

        this.name = 'MeshColoringControl';

        this.modelGroup = modelGroup;
    }

    public setTargetObject(object: Object3D): void {
        this.targetObject = object;
    }

    public setBrushData(faceExtruderMark: number, color: Color): void {
        this.faceExtruderMark = faceExtruderMark;
        this.faceColor = color;
    }

    public isActive(mode: string): boolean {
        return mode === this.mode;
    }

    public onPointerDown(pointer: Pointer): boolean {
        switch (pointer.button) {
            case MOUSE.LEFT: {
                if (this.faceExtruderMark && this.faceColor) {
                    _raycaster.setFromCamera(pointer, this.camera);
                    _raycaster.firstHitOnly = true;

                    const intersections = _raycaster.intersectObject(this.targetObject, true);
                    if (intersections.length) {
                        this.isPointerDown = true;

                        this.modelGroup.applyMeshColoringBrush(
                            intersections,
                            this.faceExtruderMark, this.faceColor
                        );

                        return true;
                    }
                }
                break;
            }
            default:
                break;
        }

        return false;
    }

    public onPointerMove(pointer: Pointer): boolean {
        if (!this.isPointerDown) return false;

        switch (pointer.button) {
            case MOUSE.LEFT: {
                if (this.faceExtruderMark && this.faceColor) {
                    _raycaster.setFromCamera(pointer, this.camera);
                    _raycaster.firstHitOnly = true;

                    const intersections = _raycaster.intersectObject(this.targetObject, true);
                    if (intersections.length) {
                        this.modelGroup.applyMeshColoringBrush(
                            intersections,
                            this.faceExtruderMark, this.faceColor
                        );
                        return true;
                    }
                }
                break;
            }
            default:
                break;
        }

        return false;
    }

    public onPointerUp(pointer: Pointer): boolean {
        if (pointer.button === MOUSE.LEFT) {
            this.isPointerDown = false;

            return true;
        } else {
            return false;
        }
    }
}
