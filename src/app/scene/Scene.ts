import EventEmitter from 'events';
import ModelGroup from '../models/ModelGroup';
import { ModelEvents } from '../models/events';


export enum SceneEvent {
    MeshChanged = 'mesh-changed',
    MeshPositionChanged = 'mesh-position-changed',

    ModelAttributesChanged = 'model-attributes-changed',
}

/**
 * Scene represents the 3D scene, the entry to access 3D objects.
 */
class Scene extends EventEmitter {
    private modelGroup: ModelGroup;

    public constructor() {
        super();

        this.modelGroup = null;
    }

    public getModelGroup(): ModelGroup {
        return this.modelGroup;
    }

    public setModelGroup(modelGroup: ModelGroup): void {
        if (this.modelGroup) {
            this.modelGroup.off(ModelEvents.MeshChanged, this.onMeshChanged);
            this.modelGroup.off(ModelEvents.MeshPositionChanged, this.onMeshPositionChanged);
            this.modelGroup.off(ModelEvents.ModelAttribtuesChanged, this.onModelAttributesChanged);
        }

        this.modelGroup = modelGroup;

        this.modelGroup.on(ModelEvents.MeshChanged, this.onMeshChanged);
        this.modelGroup.on(ModelEvents.MeshPositionChanged, this.onMeshPositionChanged);
        this.modelGroup.on(ModelEvents.ModelAttribtuesChanged, this.onModelAttributesChanged);
    }

    private onMeshChanged = (): void => {
        this.emit(SceneEvent.MeshChanged);
    };

    private onMeshPositionChanged = (): void => {
        this.emit(SceneEvent.MeshPositionChanged);
    };

    private onModelAttributesChanged = (attributeName: string): void => {
        this.emit(SceneEvent.ModelAttributesChanged, attributeName);
    }
}

// scene singleton
const scene = new Scene();

export default scene;
