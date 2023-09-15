import { find } from 'lodash';
import { Color, Float32BufferAttribute } from 'three';
import { v4 as uuid } from 'uuid';
import path from 'path';

import {
    HEAD_PRINTING,
    LEFT_EXTRUDER,
    LOAD_MODEL_FROM_INNER,
    MACHINE_EXTRUDER_X,
    MACHINE_EXTRUDER_Y,
    DATA_PREFIX,
    BOTH_EXTRUDER_MAP_NUMBER,
    RIGHT_EXTRUDER
} from '../../constants';
import CompoundOperation from '../../core/CompoundOperation';
import { controller } from '../../communication/socket-communication';
import { logToolBarOperation } from '../../lib/gaEvent';
import log from '../../lib/log';
import { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';
import ModelGroup, { BrushType } from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel, { BYTE_COUNT_LEFT_EXTRUDER, BYTE_COUNT_RIGHT_EXTRUDER } from '../../models/ThreeModel';
import { MaterialPresetModel, PresetModel } from '../../preset-model';
import {
    AddOperation3D,
    AlignGroupOperation,
    GroupOperation,
    ReplaceSplittedOperation,
    VisibilityOperation,
} from '../../scene/operations';
import UngroupOperation3D from '../../scene/operations/UngroupOperation3D';
import sceneLogic, { PrimeTowerSettings } from '../../scene/scene.logic';
import ThreeUtils from '../../scene/three-extensions/ThreeUtils';
import { actions as operationHistoryActions } from '../operation-history';
import baseActions from './actions-base';
import { MeshHelper, LoadMeshFileOptions, MeshFileInfo, loadMeshFiles } from './actions-mesh';
import scene from '../../scene/Scene';
import MeshColoringControl from '../../scene/controls/MeshColoringControl';

/* eslint-disable-next-line import/no-cycle */
import { actions as projectActions } from '../project';

const renderScene = () => (dispatch) => {
    dispatch(
        baseActions.updateState({
            renderingTimestamp: +new Date()
        })
    );
};

const discardPreview = ({ render = true }) => {
    return (dispatch, getState) => {
        const { displayedType, gcodeFile, modelGroup, gcodeLineGroup } = getState().printing;

        if (displayedType === 'gcode') {
            // Remove preview
            if (gcodeFile) {
                ThreeUtils.dispose(gcodeLineGroup);
                gcodeLineGroup.clear();
                gcodeLineGroup.visible = false;
            }

            // display model group
            modelGroup.object.visible = true;
            modelGroup.setDisplayType('model');

            dispatch(baseActions.updateState({
                gcodeFile: null,
                gcodeLine: null,
                displayedType: 'model',
                outOfMemoryForRenderGcode: false
            }));

            if (render) {
                dispatch(renderScene());
            }
        }
    };
};

const checkModelOverstep = () => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const isAnyModelOverstepped = modelGroup.getOverstepped();
        dispatch(baseActions.updateState({ isAnyModelOverstepped }));
    };
};

const getModelShellStackId = (model: ThreeModel): string => {
    const useLeftExtruder = model.extruderConfig.shell === '0';
    return useLeftExtruder ? LEFT_EXTRUDER : RIGHT_EXTRUDER;
};

/**
 * Return material preset model for model.
 *
 * We only take the material used to print shell.
 */
const getModelShellMaterialPresetModel = (model) => {
    return (dispatch, getState) => {
        const {
            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;

        const materialID = model.extruderConfig.shell === '0' ? defaultMaterialId : defaultMaterialIdRight;
        const index = materialDefinitions.findIndex((d) => d.definitionId === materialID);
        return materialDefinitions[index] ? materialDefinitions[index] : materialDefinitions[0];
    };
};

const applyPrintSettingsToModels = () => {
    return (dispatch, getState) => {
        const {
            extruderLDefinition,
            extruderRDefinition,

            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight,

            qualityDefinitions,
            activePresetIds,
            modelGroup,
        } = getState().printing;

        const leftPresetModel = find(qualityDefinitions, {
            definitionId: activePresetIds[LEFT_EXTRUDER],
        });
        const rightPresetModel = find(qualityDefinitions, {
            definitionId: activePresetIds[RIGHT_EXTRUDER],
        });

        const helperExtruderConfig = modelGroup.getHelpersExtruderConfig();

        // update global settings
        const adhesionPresetModel = helperExtruderConfig.adhesion === '0' ? leftPresetModel : rightPresetModel;
        if (adhesionPresetModel) {
            const qualitySetting = adhesionPresetModel.settings;
            modelGroup.updatePlateAdhesion({
                adhesionType: qualitySetting.adhesion_type.default_value,
                skirtLineCount: qualitySetting?.skirt_line_count?.default_value,
                brimLineCount: qualitySetting?.brim_line_count?.default_value,
                brimWidth: qualitySetting?.brim_width?.default_value,
                skirtBrimLineWidth: qualitySetting?.skirt_brim_line_width?.default_value,
                raftMargin: qualitySetting?.raft_margin?.default_value,
                skirtGap: qualitySetting?.skirt_gap?.default_value,
                brimGap: qualitySetting?.brim_gap?.default_value
            });
        }

        // update parameters for each model
        if (leftPresetModel || rightPresetModel) {
            const globalSettings = leftPresetModel.settings;

            const leftMaterialPresetModel = materialDefinitions.find((d) => d.definitionId === defaultMaterialId);
            const rightMaterialPresetModel = materialDefinitions.find((d) => d.definitionId === defaultMaterialIdRight);

            modelGroup.getThreeModels().forEach((model) => {
                let lineWidth: number = extruderLDefinition.settings.machine_nozzle_size.default_value;

                // Set extruder color
                const colors = [];
                if (leftMaterialPresetModel) {
                    colors.push(leftMaterialPresetModel.settings.color.default_value);
                }
                if (rightMaterialPresetModel) {
                    colors.push(rightMaterialPresetModel.settings.color.default_value);
                }

                model.setExtruderColors(colors);

                // Set shell color
                const shellStackId = getModelShellStackId(model);

                lineWidth = shellStackId === LEFT_EXTRUDER
                    ? extruderLDefinition.settings.machine_nozzle_size.default_value
                    : extruderRDefinition.settings.machine_nozzle_size.default_value;

                const materialPresetModel = dispatch(getModelShellMaterialPresetModel(model));
                const materialSettings = materialPresetModel.settings;

                // update material color
                model.updateMaterialColor(materialSettings.color.default_value);


                const layerHeight = globalSettings.layer_height.default_value;
                const bottomThickness = globalSettings.bottom_thickness.default_value;
                const bottomLayers = Math.ceil(Math.round(bottomThickness / layerHeight));
                const topThickness = globalSettings.top_thickness.default_value;
                const topLayers = Math.ceil(Math.round(topThickness / layerHeight));

                model.updateClipperConfig({
                    lineWidth,
                    wallThickness: globalSettings.wall_thickness.default_value,
                    topLayers,
                    bottomLayers,
                    layerHeight,
                    infillSparseDensity: globalSettings.infill_sparse_density.default_value,
                    infillPattern: globalSettings.infill_pattern.default_value,
                    magicSpiralize: globalSettings.magic_spiralize.default_value,
                });
            });
        }

        if (leftPresetModel) {
            sceneLogic.onPresetParameterChanged(LEFT_EXTRUDER, leftPresetModel);
        }
        if (rightPresetModel) {
            sceneLogic.onPresetParameterChanged(RIGHT_EXTRUDER, rightPresetModel);
        }

        // TODO: ?
        // const models = modelGroup.getModels();
        // modelGroup.models = models.concat();

        dispatch(checkModelOverstep());
        dispatch(renderScene());
    };
};

const updateSelectedModelsExtruderConfig = (extruderConfig) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const models = Object.assign([], getState().printing.modelGroup.models);

        for (const model of modelGroup.selectedModelArray) {
            let modelItem = null;
            modelGroup.traverseModels(models, item => {
                if (model.modelID === item.modelID) {
                    modelItem = item;
                }
            });

            if (modelItem) {
                modelItem.extruderConfig = {
                    ...modelItem.extruderConfig,
                    ...extruderConfig,
                };

                if (modelItem.children) {
                    modelItem.children.forEach((item) => {
                        if (extruderConfig.shell && extruderConfig.shell !== BOTH_EXTRUDER_MAP_NUMBER) {
                            item.extruderConfig = {
                                ...item.extruderConfig,
                                shell: extruderConfig.shell,
                            };
                        }
                        if (extruderConfig.infill && extruderConfig.infill !== BOTH_EXTRUDER_MAP_NUMBER) {
                            item.extruderConfig = {
                                ...item.extruderConfig,
                                infill: extruderConfig.infill,
                            };
                        }
                    });
                }
                if (
                    modelItem.parent
                    && modelItem.parent instanceof ThreeGroup
                ) {
                    modelItem.parent.updateGroupExtruder();
                }
            }
        }

        dispatch(applyPrintSettingsToModels());
        // dispatch(actions.updateBoundingBox());
        dispatch(renderScene());
        modelGroup.models = [...models];
        modelGroup.modelAttributesChanged('extruderConfig');
    };
};


/**
 * Set both transformMode and modelGroup's transform mode.
 */
const setTransformMode = (value: string) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        modelGroup.setTransformMode(value);
        dispatch(baseActions.updateState({
            transformMode: value
        }));
        dispatch(renderScene());
    };
};

/**
 * Set brush type.
 */
const setBrushType = (brushType: BrushType) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        modelGroup.setBrushType(brushType);

        dispatch(baseActions.updateState({
            brushType
        }));
    };
};

const moveBrush = (raycastResult) => {
    return (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;
        modelGroup.moveBrush(raycastResult);
    };
};

const setSmartFillBrushAngle = (angle: number) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.setSmartFillBrushAngle(angle);
    };
};

// status: add | remove
const setSupportBrushStatus = (status: 'add' | 'remove') => {
    return (dispatch) => {
        dispatch(
            baseActions.updateState({
                supportBrushStatus: status
            })
        );
    };
};

/**
 * Start mesh coloring mode.
 */
const startMeshColoringMode = () => {
    return async (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;
        const { progressStatesManager } = getState().printing;

        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_MESH_COLORING_PREPARE);
        dispatch(
            baseActions.updateState({
                stage: STEP_STAGE.PRINTING_MESH_COLORING_PREPARE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_MESH_COLORING_PREPARE, 0.25),
            })
        );

        // Use setTimeout to display progress
        const p = new Promise((resolve) => {
            setTimeout(() => {
                dispatch(updateSelectedModelsExtruderConfig({ infill: '0', shell: '0' }));

                modelGroup.startMeshColoring();

                resolve(true);
            }, 50);
        });
        await p;

        // modelGroup.startMeshColoring();
        dispatch(setTransformMode('mesh-coloring'));

        dispatch(
            baseActions.updateState({
                stage: STEP_STAGE.PRINTING_MESH_COLORING_PREPARE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_MESH_COLORING_PREPARE, 1),
            })
        );

        dispatch(discardPreview({ render: true }));
    };
};

const endMeshColoringMode = (shouldApplyChanges = false) => {
    return (dispatch, getState) => {
        dispatch(setTransformMode(''));

        // control cleanup
        // const controlManager = scene.getControlManager();
        // const meshColoringControl = controlManager.getControl('mesh-coloring') as MeshColoringControl;
        // meshColoringControl.clearHighlight();

        const modelGroup = getState().printing.modelGroup as ModelGroup;
        if (shouldApplyChanges) {
            modelGroup.finishMeshColoring();
        } else {
            modelGroup.finishMeshColoring(false);
        }

        dispatch(renderScene());

        dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
    };
};

const _getMaterialPresetModel = (materialPresetModels: MaterialPresetModel[], presetId: string): MaterialPresetModel => {
    const index = materialPresetModels.findIndex((m) => m.definitionId === presetId);
    if (index >= 0) {
        return materialPresetModels[index];
    } else {
        return null;
    }
};

const setMeshStackId = (brushStackId: string) => {
    return (dispatch, getState) => {
        if (![LEFT_EXTRUDER, RIGHT_EXTRUDER].includes(brushStackId)) {
            return;
        }

        dispatch(baseActions.updateState({
            brushStackId
        }));

        const {
            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;

        const materialPresetId = brushStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;

        const materialPresetModel = _getMaterialPresetModel(materialDefinitions, materialPresetId);
        const colorString = materialPresetModel.settings.color.default_value as string;
        const color = new Color(colorString);

        let faceExtruderMark = 0;
        if (brushStackId === LEFT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_LEFT_EXTRUDER;
        } else if (brushStackId === RIGHT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_RIGHT_EXTRUDER;
        }

        // Update control data
        const controlManager = scene.getControlManager();
        const meshColoringControl = controlManager.getControl('mesh-coloring') as MeshColoringControl;

        meshColoringControl.setBrushData(faceExtruderMark, color);
    };
};

/**
 * Apply raycast result to mesh effect.
 */
const applyMeshColoringBrush = (raycastResult) => {
    return (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;
        const {
            brushStackId,

            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;

        const materialPresetId = brushStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;

        const materialPresetModel = _getMaterialPresetModel(materialDefinitions, materialPresetId);
        const colorString = materialPresetModel.settings.color.default_value as string;
        const color = new Color(colorString);

        let faceExtruderMark = 0;
        if (brushStackId === LEFT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_LEFT_EXTRUDER;
        } else if (brushStackId === RIGHT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_RIGHT_EXTRUDER;
        }
        modelGroup.applyMeshColoringBrush(raycastResult, faceExtruderMark, color);
    };
};

const uploadModelsForSupport = (models: ThreeModel[], angle: number) => {
    return async (dispatch, getState) => {
        const { qualityDefinitions, activePresetIds } = getState().printing;
        const activeQualityDefinition = find(qualityDefinitions, {
            definitionId: activePresetIds[LEFT_EXTRUDER],
        });
        return new Promise((resolve) => {
            // upload model stl
            setTimeout(async () => {
                const params = {
                    data: []
                };
                for (const model of models) {
                    const mesh = model.meshObject.clone(false);
                    mesh.clear();
                    model.meshObject.parent.updateMatrixWorld();
                    mesh.applyMatrix4(model.meshObject.parent.matrixWorld);

                    // negative scale flips normals, just flip them back by changing the winding order of faces
                    // https://stackoverflow.com/questions/16469270/transforming-vertex-normals-in-three-js/16469913#16469913
                    if (
                        model.transformation.scaleX
                        * model.transformation.scaleY
                        * model.transformation.scaleZ
                        < 0
                    ) {
                        mesh.geometry = mesh.geometry.clone();
                        const positions = mesh.geometry.getAttribute('position').array as number[];

                        for (let i = 0; i < positions.length; i += 9) {
                            const tempX = positions[i + 0];
                            const tempY = positions[i + 1];
                            const tempZ = positions[i + 2];

                            positions[i + 0] = positions[i + 6];
                            positions[i + 1] = positions[i + 7];
                            positions[i + 2] = positions[i + 8];

                            positions[i + 6] = tempX;
                            positions[i + 7] = tempY;
                            positions[i + 8] = tempZ;
                        }
                        mesh.geometry.computeVertexNormals();
                    }
                    // Add byte_count attribute for STL binary exporter

                    // replace byte count attribute
                    const originalByteCountAttribute = mesh.geometry.getAttribute('byte_count');
                    mesh.geometry.setAttribute('byte_count', new Float32BufferAttribute(model.supportFaceMarks.slice(0), 1));

                    const originalName = model.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(
                        uploadPath,
                        path.extname(uploadPath)
                    );
                    const stlFileName = `${basenameWithoutExt}.stl`;
                    const uploadResult = await MeshHelper.uploadMesh(mesh, stlFileName);

                    // restore byte count attribute
                    if (originalByteCountAttribute) {
                        mesh.geometry.setAttribute('byte_count', originalByteCountAttribute);
                    }

                    params.data.push({
                        modelID: model.modelID,
                        uploadName: uploadResult.body.uploadName,
                        // specify generated support name
                        supportStlFilename: uploadResult.body.uploadName.replace(
                            /\.stl$/,
                            `_support_${Date.now()}.stl`
                        ),
                        config: {
                            support_angle: angle,
                            layer_height_0: activeQualityDefinition.settings.layer_height_0.default_value,
                            support_mark_area: false // tell engine to use marks in binary STL file
                        }
                    });
                }
                resolve(params);
            }, 50);
        });
    };
};

const generateSupports = (models: ThreeModel[], angle: number) => {
    return async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        const { size } = getState().machine;

        if (!models || models.length === 0) {
            return;
        }

        if (!progressStatesManager.inProgress()) {
            progressStatesManager.startProgress(
                PROCESS_STAGE.PRINTING_GENERATE_SUPPORT,
                [1]
            );
        } else {
            progressStatesManager.startNextStep();
        }
        dispatch(
            baseActions.updateState({
                stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, 0)
            })
        );

        const params = await dispatch(
            uploadModelsForSupport(models, angle)
        );
        params.size = size;
        controller.generateSupport(params);
    };
};

const computeAutoSupports = (angle) => {
    return (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;

        // record previous support face marks for undo&redo
        const tmpSupportFaceMarks = {};
        // Give priority to the selected supporting models, Second, apply all models
        const selectedAvailModels = modelGroup.getModelsAttachedSupport(false);
        const availModels = selectedAvailModels.length > 0
            ? selectedAvailModels
            : modelGroup.getModelsAttachedSupport();

        if (availModels.length > 0) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
            dispatch(
                baseActions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
                })
            );

            availModels.forEach((model) => {
                tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
            });
            dispatch(
                baseActions.updateState({
                    tmpSupportFaceMarks
                })
            );

            const models = modelGroup.computeSupportArea(availModels, angle);

            dispatch(
                baseActions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
                })
            );
            if (models.length > 0) {
                dispatch(generateSupports(models, angle));
            }

            dispatch(renderScene());
        }
    };
};

const startEditSupportMode = () => {
    return (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;

        modelGroup.startEditSupportMode();

        dispatch(setTransformMode('support-edit'));

        dispatch(discardPreview({ render: true }));
    };
};

const finishEditSupportMode = (shouldApplyChanges = false) => {
    return (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;

        if (shouldApplyChanges) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
            dispatch(
                baseActions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
                })
            );

            // record previous support face marks for undo&redo
            const tmpSupportFaceMarks = {};
            const availModels = modelGroup.getModelsAttachedSupport();
            availModels.forEach((model) => {
                tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
            });
            dispatch(
                baseActions.updateState({
                    tmpSupportFaceMarks
                })
            );

            const models = modelGroup.finishEditSupportArea(true);

            dispatch(
                baseActions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
                })
            );

            dispatch(generateSupports(models, 0));
        } else {
            modelGroup.finishEditSupportArea(false);
        }

        // Set back to support mode
        dispatch(setTransformMode('support'));
        dispatch(renderScene());
    };
};

const updateSupportOverhangAngle = (angle: number) => {
    return (dispatch) => {
        dispatch(
            baseActions.updateState({
                supportOverhangAngle: angle
            })
        );
    };
};

const setSupportBrushRadius = (radius: number) => {
    return (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;
        modelGroup.setSupportBrushRadius(radius);
        dispatch(renderScene());
    };
};

const applySupportBrush = (raycastResult) => {
    return (dispatch, getState) => {
        const modelGroup = getState().printing.modelGroup as ModelGroup;
        const { supportBrushStatus } = getState().printing;
        modelGroup.applySupportBrush(raycastResult, supportBrushStatus);
    };
};

/**
 * Set visibility of model / group, if no target set, selected model(s)
 * will be the target.
 */
const setModelVisibility = (target: ThreeModel | ThreeGroup | null, visible: boolean) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const targetModels = [];
        if (target) {
            targetModels.push(target);
        } else {
            targetModels.push(...modelGroup.getSelectedModelArray());
        }

        const compoundOperation = new CompoundOperation();
        for (const model of targetModels) {
            const operation = new VisibilityOperation({
                target: model,
                visible,
            });
            compoundOperation.push(operation);
        }
        compoundOperation.registerCallbackAll(() => {
            dispatch(baseActions.updateState(modelGroup.getState()));
            dispatch(discardPreview({ render: true }));
        });
        compoundOperation.redo();

        dispatch(
            operationHistoryActions.setOperations(
                HEAD_PRINTING,
                compoundOperation,
            )
        );
    };
};

/**
 * Set visibility of model / group to true, if no target set, selected model(s)
 * will be the target.
 */
const showModels = (target: ThreeModel | ThreeGroup | null = null) => {
    return setModelVisibility(target, true);
};

/**
 * Set visibility of model / group to false, if no target set, selected model(s)
 * will be the target.
 */
const hideModels = (target: ThreeModel | ThreeGroup | null = null) => {
    return setModelVisibility(target, false);
};

const duplicateSelectedModel = () => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        modelGroup.duplicateSelectedModel();

        dispatch(baseActions.updateState(modelGroup.getState()));
        dispatch(renderScene());
        dispatch(applyPrintSettingsToModels());

        const compoundOperation = new CompoundOperation();
        for (const model of modelGroup.selectedModelArray) {
            const operation = new AddOperation3D({
                target: model,
                parent: null,
            });
            compoundOperation.push(operation);
        }
        compoundOperation.registerCallbackAll(() => {
            dispatch(baseActions.updateState(modelGroup.getState()));
            dispatch(renderScene());
            dispatch(applyPrintSettingsToModels());
        });
        dispatch(
            operationHistoryActions.setOperations(
                HEAD_PRINTING,
                compoundOperation
            )
        );
    };
};

const groupSelectedModels = () => {
    return (dispatch, getState) => {
        logToolBarOperation(HEAD_PRINTING, 'group');

        const { modelGroup } = getState().printing;
        const selectedModels = modelGroup.getSelectedModelArray().slice(0);

        const operation = new GroupOperation({
            target: selectedModels,
            modelGroup,
        });

        const compoundOperation = new CompoundOperation();
        compoundOperation.push(operation);
        compoundOperation.registerCallbackAll(() => {
            dispatch(baseActions.updateState(modelGroup.getState()));
            dispatch(renderScene());
        });
        compoundOperation.redo();

        dispatch(
            operationHistoryActions.setOperations(
                HEAD_PRINTING,
                compoundOperation,
            )
        );
    };
};

/**
 * Align selected models, and add them to a new group.
 */
const alignGroupSelectedModels = () => {
    return (dispatch, getState) => {
        logToolBarOperation(HEAD_PRINTING, 'align');

        const { modelGroup } = getState().printing;

        const selectedModels = modelGroup.getSelectedModelArray().slice(0);
        for (const model of selectedModels) {
            if (!(model instanceof ThreeModel)) {
                log.warn('Unable to process Align operation, not all models selected are of type ThreeModel');
                return;
            }
        }

        const operation = new AlignGroupOperation({
            // selectedModelsPositionMap,
            // selectedModels,
            // newPosition: newGroup.transformation,
            target: selectedModels as ThreeModel[],
            modelGroup,
        });

        const compoundOperation = new CompoundOperation();
        compoundOperation.push(operation);
        compoundOperation.registerCallbackAll(() => {
            dispatch(baseActions.updateState(modelGroup.getState()));
            dispatch(renderScene());
        });
        compoundOperation.redo();

        dispatch(
            operationHistoryActions.setOperations(
                HEAD_PRINTING,
                compoundOperation,
            )
        );
    };
};


const ungroupSelectedModels = () => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const groups = modelGroup
            .getSelectedModelArray()
            .filter((model) => model instanceof ThreeGroup);
        const modelsBeforeUngroup = modelGroup.getModels().slice(0);
        const groupChildrenMap = new Map();
        groups.forEach((group) => {
            groupChildrenMap.set(group, {
                groupTransformation: { ...group.transformation },
                subModelStates: group.children.map((model) => {
                    return {
                        target: model,
                        transformation: { ...model.transformation }
                    };
                })
            });
        });
        const operations = new CompoundOperation();

        const modelState = modelGroup.ungroup();
        modelGroup.calaClippingMap();

        groups.forEach((group) => {
            const operation = new UngroupOperation3D({
                modelsBeforeUngroup,
                target: group,
                groupTransformation: groupChildrenMap.get(group)
                    .groupTransformation,
                subModelStates: groupChildrenMap.get(group).subModelStates,
                modelGroup
            });
            operations.push(operation);
        });
        operations.registerCallbackAll(() => {
            dispatch(baseActions.updateState(modelGroup.getState()));
            dispatch(renderScene());
        });

        dispatch(
            operationHistoryActions.setOperations(
                HEAD_PRINTING,
                operations
            )
        );
        dispatch(baseActions.updateState(modelState));
        logToolBarOperation(HEAD_PRINTING, 'ungroup');
    };
};

/**
 * Split selected model (support exactly one model).
 */
const splitSelectedModel = () => {
    return async (dispatch, getState) => {
        logToolBarOperation(HEAD_PRINTING, 'split');

        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SPLIT_MODEL);

        const modelGroup = getState().printing.modelGroup as ModelGroup;
        if (!modelGroup) {
            return false;
        }

        // only support split on one single model
        const selectedModels = modelGroup.selectedModelArray;
        if (selectedModels.length !== 1) return false;

        // check visibility
        const targetModel = selectedModels[0] as ThreeModel;
        if (!targetModel.visible) return false;

        const task = new Promise((resolve, reject) => {
            controller.splitMesh({
                uploadName: targetModel.uploadName,
            }, (data) => {
                const { type } = data;
                switch (type) {
                    case 'error':
                        reject(new Error('Failed to split models.'));
                        break;
                    case 'success':
                        resolve(data.result);
                        break;
                    default:
                        break;
                }
            });
        });

        try {
            const taskResult = await task as {
                meshes: { uploadName: string }[]
            };

            const meshFileInfos: MeshFileInfo[] = [];
            for (let i = 0; i < taskResult.meshes.length; i++) {
                const mesh = taskResult.meshes[i];
                const { uploadName } = mesh;

                const modelInfo: MeshFileInfo = {
                    uploadName,
                    originalName: uploadName,
                    modelName: `${uploadName} Part ${i + 1}`,
                    isGroup: false,
                    modelID: uuid(),
                    parentUploadName: targetModel.uploadName,
                };

                const modelNameObj = modelGroup._createNewModelName({
                    sourceType: '3d',
                    originalName: modelInfo.modelName,
                });

                modelInfo.modelName = modelNameObj.name;
                modelInfo.baseName = modelNameObj.baseName;

                meshFileInfos.push(modelInfo);
            }

            const loadMeshFileOptions: LoadMeshFileOptions = {
                headType: HEAD_PRINTING,
                loadFrom: LOAD_MODEL_FROM_INNER,
                sourceType: '3d',
            };

            // ignore prompt tasks
            const loadMeshResult = await loadMeshFiles(meshFileInfos, modelGroup, loadMeshFileOptions);

            // construct group with splited models
            modelGroup.addModelToSelectedGroup(...loadMeshResult.models);
            const splittedModels = modelGroup.getSelectedModelArray<ThreeModel>().slice(0);

            // Align splitted models to construct a new group
            const operation = new AlignGroupOperation({
                modelGroup,
                target: splittedModels,
            });
            operation.redo();

            // unselect all
            modelGroup.unselectAllModels();

            // remove splitted group first
            const newGroup = operation.getNewGroup();
            ThreeUtils.removeObjectParent(newGroup.meshObject);
            const index = modelGroup.models.findIndex((child) => child.modelID === newGroup.modelID);
            if (index >= 0) {
                modelGroup.models.splice(index, 1);
            }

            // replace original model with splitted group
            const replaceOperation = new ReplaceSplittedOperation({
                modelGroup,
                model: targetModel,
                splittedGroup: newGroup,
            });

            const compoundOperation = new CompoundOperation();
            compoundOperation.push(replaceOperation);
            compoundOperation.registerCallbackAll(() => {
                dispatch(baseActions.updateState(modelGroup.getState()));
                dispatch(renderScene());
            });
            compoundOperation.redo();

            dispatch(
                operationHistoryActions.setOperations(
                    HEAD_PRINTING,
                    compoundOperation,
                )
            );
        } catch (e) {
            log.error('task failed, error =', e);
            return false;
        }

        return true;
    };
};

const finalizeSceneSettings = (
    extruderDefinitions: object[],
    globalQualityPreset: PresetModel,
    extruderPresetModels: PresetModel[],
) => (dispatch, getState) => {
    const {
        modelGroup,
        helpersExtruderConfig,
    } = getState().printing;

    const {
        size,
    } = getState().machine;

    const primeTowerModel = modelGroup.getPrimeTower();
    const primeTowerSettings: PrimeTowerSettings = {
        enabled: primeTowerModel.visible,
    };

    if (primeTowerModel.visible) {
        // In slice engine, prime tower position is defined as bottom right corner of the shape,
        // yet we define it as center of shape, so add some offset to parameters
        const primeTowerBox = primeTowerModel.boundingBox;
        const primeTowerSize = primeTowerBox.max.x - primeTowerBox.min.x;
        const primeTowerPosition = {
            x: (primeTowerBox.min.x + primeTowerBox.max.x) / 2,
            y: (primeTowerBox.min.y + primeTowerBox.max.y) / 2,
        };

        const primeTowerBottomRightX = primeTowerPosition.x + primeTowerSize / 2;
        const primeTowerBottomRightY = primeTowerPosition.y - primeTowerSize / 2;

        // Very weird offset calculation by the slice engine
        const adhesionType = globalQualityPreset.settings.adhesion_type?.default_value;
        const hasPrimeTowerBrim = globalQualityPreset.settings.prime_tower_brim_enable?.default_value;

        let offset = 0;
        if (hasPrimeTowerBrim && adhesionType !== 'raft') {
            const initialLayerLineWidthFactor = globalQualityPreset.settings.initial_layer_line_width_factor?.default_value || 0;
            const brimLineCount = globalQualityPreset?.settings?.brim_line_count?.default_value;
            const adhesionExtruder = helpersExtruderConfig.adhesion;

            // Note that line width is settable per extruder, we need to use correct extruder preset
            let skirtBrimLineWidth;
            if (adhesionExtruder === '0') {
                skirtBrimLineWidth = extruderPresetModels[0].settings?.skirt_brim_line_width?.default_value;
            } else if (adhesionExtruder === '1') {
                skirtBrimLineWidth = extruderPresetModels[1].settings?.skirt_brim_line_width?.default_value;
            } else {
                skirtBrimLineWidth = globalQualityPreset.settings?.skirt_brim_line_width?.default_value;
            }

            offset = brimLineCount * skirtBrimLineWidth * initialLayerLineWidthFactor / 100;
        }

        // Convert scene position to work position
        primeTowerSettings.size = primeTowerSize;
        primeTowerSettings.positionX = size.x / 2 + primeTowerBottomRightX + offset;
        primeTowerSettings.positionY = size.y / 2 + primeTowerBottomRightY + offset;
    }

    // Rewrite prime tower settings
    globalQualityPreset.settings.prime_tower_enable.default_value = primeTowerSettings.enabled;
    if (primeTowerSettings.enabled) {
        globalQualityPreset.settings.prime_tower_position_x.default_value = primeTowerSettings.positionX;
        globalQualityPreset.settings.prime_tower_position_y.default_value = primeTowerSettings.positionY;
        globalQualityPreset.settings.prime_tower_size.default_value = primeTowerSettings.size;
    }

    for (const extruderDefinition of extruderDefinitions) {
        // Rewrite start/end position for extruders
        if (primeTowerSettings.enabled) {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = true;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = true;

            MACHINE_EXTRUDER_X.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerSettings.positionX;
            });
            MACHINE_EXTRUDER_Y.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerSettings.positionY;
            });
        } else {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = false;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = false;
        }
    }
};


export default {
    // basic scene actions
    renderScene,

    discardPreview,

    // print settings -> scene
    applyPrintSettingsToModels,

    // brush
    setBrushType,
    moveBrush,
    setSmartFillBrushAngle,
    setSupportBrushStatus,

    // mesh - mesh coloring
    startMeshColoringMode,
    endMeshColoringMode,
    setMeshStackId,
    applyMeshColoringBrush,

    // mesh - edit support
    computeAutoSupports,
    startEditSupportMode,
    finishEditSupportMode,
    updateSupportOverhangAngle,
    setSupportBrushRadius,
    applySupportBrush,

    // model operations
    setModelVisibility,
    showModels,
    hideModels,
    duplicateSelectedModel,
    groupSelectedModels,
    alignGroupSelectedModels,
    ungroupSelectedModels,
    splitSelectedModel,

    // scene -> print settings
    finalizeSceneSettings,
};
