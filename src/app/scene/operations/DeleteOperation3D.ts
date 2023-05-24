import ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import ThreeUtils from '../three-extensions/ThreeUtils';
import type { DispatchType } from '../../flux/index.def';
import Operation from '../../core/Operation';

type DeleteOperationProp = {
    target: ThreeGroup | ThreeModel,
};

type DeleteOperationState = {
    target: ThreeGroup | ThreeModel,
    modelGroup: ModelGroup
    groupTransformation: ModelTransformation,
    modelTransformation: Map<string, ModelTransformation>,
    childrens?: Array<ThreeGroup | ThreeModel>,
    dispatch?: DispatchType;
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
        modelGroup.modelChanged();
        modelGroup.childrenChanged();
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
            modelGroup.updateModelNameMap(model.modelName, model.baseName, 'add');
            modelGroup.recoverModelClippingGroup(model);
            ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            model.children.forEach((subModel) => {
                ThreeUtils.setObjectParent(subModel.meshObject, model.meshObject);
                setGlobalTransform(modelGroup, subModel, this.state.modelTransformation.get(subModel.modelID));
            });
        }
        if (model.isSelected) {
            model.setSelected(false);
        }
        this.state.modelGroup.unselectAllModels();
        modelGroup.stickToPlateAndCheckOverstepped(model);

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.modelChanged();
        modelGroup.childrenChanged();
    }
}
