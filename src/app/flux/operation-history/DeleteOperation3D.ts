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

const getGlobalTransform = (modelGroup, model) => {
    modelGroup.unselectAllModels();
    modelGroup.addModelToSelectedGroup(model);
    return modelGroup.getSelectedModelTransformationForPrinting();
};

const setGlobalTransform = (modelGroup, model, modelTransformation) => {
    modelGroup.unselectAllModels();
    modelGroup.addModelToSelectedGroup(model);
    modelGroup.updateSelectedGroupTransformation({
        ...modelTransformation
    });
};

export default class DeleteOperation3D extends Operation<DeleteOperationState> {
    public constructor(props: DeleteOperationProp) {
        super();

        const model = props.target;

        this.state = {
            target: props.target,
            modelGroup: props.target.modelGroup,
            groupTransformation: (() => {
                if (model instanceof ThreeGroup) {
                    return { ...getGlobalTransform(props.target.modelGroup, model) };
                } else {
                    if (model.parent && model.parent instanceof ThreeGroup) {
                        return { ...getGlobalTransform(props.target.modelGroup, model.parent) };
                    }
                }
                return null;
            })(),
            modelTransformation: new Map(),
            childrens: []
        };

        if (model instanceof ThreeModel) {
            this.state.modelTransformation.set(model.modelID, { ...getGlobalTransform(props.target.modelGroup, model) });
            if (model.parent && model.parent instanceof ThreeGroup) {
                model.parent.children.forEach((subModel) => {
                    this.state.modelTransformation.set(subModel.modelID, {
                        ...getGlobalTransform(props.target.modelGroup, subModel)
                    });
                });
            } else {
                this.state.modelTransformation.set(model.modelID, {
                    ...getGlobalTransform(props.target.modelGroup, model)
                });
            }
        } else if (model instanceof ThreeGroup) {
            model.children.forEach((subModel) => {
                this.state.childrens.push(subModel);

                this.state.modelTransformation.set(subModel.modelID, {
                    ...getGlobalTransform(props.target.modelGroup, subModel)
                });
            });
        }
        this.state.modelGroup.unselectAllModels();
    }

    public redo() {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;

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

        if (model instanceof ThreeModel) {
            if (model.parent && model.parent instanceof ThreeGroup) {
                if (modelGroup.models.find((m) => m.modelID === model.parent.modelID)) {
                    modelGroup.recoveryGroup(model.parent, model);
                    model.parent.children.forEach((subModel) => {
                        setGlobalTransform(modelGroup, subModel, this.state.modelTransformation.get(subModel.modelID));
                    });
                }
            } else {
                modelGroup.models = modelGroup.models.concat(model);
                modelGroup.recoverModelClippingGroup(model);
                modelGroup.object.add(model.meshObject);
                setGlobalTransform(modelGroup, model, this.state.modelTransformation.get(model.modelID));
            }
        } else if (model instanceof ThreeGroup) {
            model.children = this.state.childrens;
            modelGroup.models = modelGroup.models.concat(model);
            modelGroup.recoverModelClippingGroup(model);
            ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            model.children.forEach((subModel) => {
                setGlobalTransform(modelGroup, subModel, this.state.modelTransformation.get(subModel.modelID));
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
