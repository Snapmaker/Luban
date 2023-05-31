import { Object3D, Camera } from 'three';

enum Priority {
    // User custom behavior
    High = -1,

    // standard MSR (move, scale, rotate)
    Standard = 0,

    // User custom behavior
    Low = 1,
}

export class Pointer {
    public x: number;
    public y: number;
    public button: number;

    public constructor(x: number, y: number, button: number) {
        this.x = x;
        this.y = y;
        this.button = button;
    }
}

export default abstract class Control extends Object3D {
    protected priority: Priority = Priority.Low;
    protected camera: Camera;
    private domElement: HTMLCanvasElement = null;

    public constructor(camera: Camera) {
        super();

        this.type = 'Control';
        this.camera = camera;
    }

    public getPriority(): Priority {
        return this.priority;
    }

    public bind(domElement: HTMLCanvasElement): void {
        this.domElement = domElement;
    }

    // https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/TransformControls.js
    private getPointer(event: MouseEvent): Pointer {
        if (this.domElement.ownerDocument.pointerLockElement) {
            return new Pointer(0, 0, event.button);
        } else {
            const rect = this.domElement.getBoundingClientRect();

            // convert x, y to range [-1, 1]
            return new Pointer(
                (event.clientX - rect.left) / rect.width * 2 - 1,
                -(event.clientY - rect.top) / rect.height * 2 + 1,
                event.button
            );
        }
    }

    public abstract isActive(mode: string): boolean;

    public abstract onPointerDown(pointer: Pointer): boolean;
}
