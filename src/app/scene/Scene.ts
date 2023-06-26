import EventEmitter from 'events';
import ModelGroup from '../models/ModelGroup';
import { ModelEvents } from '../models/events';

// TODO: Move this object to app/scene directory
import PrintableCube from '../ui/widgets/PrintingVisualizer/PrintableCube';
import ControlManager from '../ui/components/SMCanvas/ControlManager';

export enum SceneEvent {
    // model
    ModelAttributesChanged = 'model-attributes-changed',

    // mesh
    MeshChanged = 'mesh-changed',
    MeshPositionChanged = 'mesh-position-changed',

    // build volume
    BuildVolumeChanged = 'build-volume-changed',
}

/**
 * Scene represents the 3D scene, the entry to access 3D objects.
 */
class Scene extends EventEmitter {
    private modelGroup?: ModelGroup;
    private buildVolume?: PrintableCube;

    private controlManager?: ControlManager = null;

    public constructor() {
        super();

        this.modelGroup = null;
        this.buildVolume = null;
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
    };

    //
    // build volume
    //

    public getBuildVolume(): PrintableCube {
        return this.buildVolume;
    }

    public setBuildVolume(buildVolume: PrintableCube): void {
        if (this.buildVolume) {
            this.buildVolume.removeEventListener('update', this.onWorkRangeChanged);
        }

        this.buildVolume = buildVolume;

        this.buildVolume.addEventListener('update', this.onWorkRangeChanged);
    }

    private onWorkRangeChanged = (): void => {
        this.emit(SceneEvent.BuildVolumeChanged);
    };

    public getControlManager(): ControlManager | null {
        return this.controlManager;
    }

    public setControlManager(controlManager: ControlManager): void {
        this.controlManager = controlManager;
    }
}

// scene singleton
const scene = new Scene();

export default scene;
