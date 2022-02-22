import type ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';
import ThreeModel from '../../models/ThreeModel';
import { ModelTransformation } from '../../models/ThreeBaseModel';

type DeleteOperationProp = {
    target: ThreeGroup | ThreeModel,
};

type DeleteOperationState = {
    target: ThreeGroup | ThreeModel,
    modelGroup: ModelGroup
    groupTransformation: ModelTransformation,
    modelTransformation: Map<string, ModelTransformation>,
    childrens?: Array<ThreeGroup | ThreeModel>
};

export default class DeleteOperation3D extends Operation<DeleteOperationState> {
    constructor(props: DeleteOperationProp) {
        super();

        const model = props.target;

        this.state = {
            target: props.target,
            modelGroup: props.target.modelGroup,
            groupTransformation: (() => {
                if (model instanceof ThreeGroup) {
                    return { ...model.transformation };
                } else {
                    if (model.parent && model.parent instanceof ThreeGroup) {
                        return { ...model.parent.transformation };
                    }
                }
                return null;
            })(),
            modelTransformation: new Map(),
            childrens: []
        };

        if (model instanceof ThreeModel) {
            this.state.modelTransformation.set(model.modelID, model.transformation);
            if (model.parent && model.parent instanceof ThreeGroup) {
                model.parent.children.forEach(subModel => {
                    this.state.modelGroup.unselectAllModels();
                    this.state.modelGroup.addModelToSelectedGroup(subModel);
                    this.state.modelTransformation.set(subModel.modelID, {
                        ...this.state.modelGroup.getSelectedModelTransformationForPrinting()
                    });
                });
            } else {
                this.state.modelTransformation.set(model.modelID, model.transformation);
            }
        } else if (model instanceof ThreeGroup) {
            model.children.forEach(subModel => {
                this.state.childrens.push(subModel);
                this.state.modelTransformation.set(subModel.modelID, { ...subModel.transformation });
            });
        }

        // an object to be deleted will be selected at first, unwrapped from parent group
        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (model instanceof ThreeModel && model.supportTag) {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            } else {
                if (model.parent) {
                    ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
                } else {
                    ThreeUtils.setObjectParent(model.meshObject, props.target.modelGroup.object);
                }
            }
        }
        this.state.modelGroup.unselectAllModels();
        this.state.modelGroup.addModelToSelectedGroup(model);
    }

    public redo() {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;

        if (model instanceof ThreeModel && model.supportTag) {
            ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
        } else {
            if (model.parent) {
                ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            }
        }
        modelGroup.removeModel(model);
        if (model.isSelected) {
            model.setSelected(false);
            // trigger <VisualizerLeftBar> popup component hidden
            modelGroup.unselectAllModels();
        }
        modelGroup.updatePrimeTowerHeight();
        modelGroup.modelChanged();
    }

    public undo() {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;

        if (model instanceof ThreeModel && model.supportTag) {
            if (!model.target) return;
            modelGroup.models = modelGroup.models.concat(model);
            model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else if (model instanceof ThreeModel) {
            if (model.parent && model.parent instanceof ThreeGroup) {
                if (modelGroup.models.find(m => m.modelID === model.parent.modelID)) {
                    modelGroup.recoveryGroup(model.parent, model);
                    model.parent.children.forEach((subModel) => {
                        modelGroup.unselectAllModels();
                        modelGroup.addModelToSelectedGroup(subModel);
                        modelGroup.updateSelectedGroupTransformation({
                            ...this.state.modelTransformation.get(subModel.modelID)
                        });
                    });
                } else {
                    modelGroup.models = modelGroup.models.concat(model.parent);
                    ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
                    ThreeUtils.setObjectParent(model.parent.meshObject, modelGroup.object);
                }
            } else {
                modelGroup.models = modelGroup.models.concat(model);
                modelGroup.object.add(model.meshObject);
            }
        } else if (model instanceof ThreeGroup) {
            model.children = this.state.childrens;
            modelGroup.models = modelGroup.models.concat(model);
            ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            model.children.forEach(subModel => {
                ThreeUtils.setObjectParent(subModel.meshObject, model.meshObject);
            });
        }
        if (model.isSelected) {
            model.setSelected(false);
        }
        modelGroup.stickToPlateAndCheckOverstepped(model);

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.updatePrimeTowerHeight();
        modelGroup.modelChanged();
        this.state.modelGroup.unselectAllModels();
    }
}
