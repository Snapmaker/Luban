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
    protected enabled: boolean = false;
    protected priority: Priority = Priority.Low;
    protected camera: Camera;

    public constructor(camera: Camera) {
        super();

        this.type = 'Control';
        this.camera = camera;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public getPriority(): Priority {
        return this.priority;
    }

    public abstract onPointerHover(pointer: Pointer): boolean;

    public abstract onPointerDown(pointer: Pointer): boolean;

    public abstract onPointerMove(pointer: Pointer): boolean;

    public abstract onPointerUp(pointer: Pointer): boolean;
}
