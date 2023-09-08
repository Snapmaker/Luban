import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { EPSILON, HEAD_PRINTING } from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { actions as printingActions } from '../../../flux/printing';
import { logTransformOperation } from '../../../lib/gaEvent';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import UniApi from '../../../lib/uni-api';
import PrimeTowerModel from '../../../models/PrimeTowerModel';
import ThreeGroup from '../../../models/ThreeGroup';
import SvgIcon from '../../components/SvgIcon';
import { PageMode } from '../../pages/PageMode';
import ChangePrintModeOverlay from '../../views/model-operation-overlay/ChangePrintModeOverlay';
import EditSupportOverlay from '../../views/model-operation-overlay/EditSupportOverlay';
import MeshColoringOverlay from '../../views/model-operation-overlay/MeshColoringOverlay';
import RotationAnalysisOverlay from '../../views/model-operation-overlay/RotationAnalysisOverlay';
import SimplifyModelOverlay from '../../views/model-operation-overlay/SimplifyOverlay';
import styles from './styles.styl';

/* eslint-disable-next-line import/no-cycle */
import MirrorOverlay from '../../views/model-operation-overlay/MirrorOverlay';
/* eslint-disable-next-line import/no-cycle */
import RotateOverlay from '../../views/model-operation-overlay/RotateOverlay';
/* eslint-disable-next-line import/no-cycle */
import ModelScaleOverlay from '../../views/model-operation-overlay/ModelScaleOverlay';
/* eslint-disable-next-line import/no-cycle */
import SupportOverlay from '../../views/model-operation-overlay/SupportOverlay';
/* eslint-disable-next-line import/no-cycle */
import TranslateOverlay from '../../views/model-operation-overlay/TranslateOverlay';
import ThreeModel from '../../../models/ThreeModel';

export const CancelButton = ({ onClick }) => {
    return (
        <SvgIcon
            size={24}
            name="Cancel"
            type={['static']}
            onClick={onClick}
        />
    );
};
CancelButton.propTypes = {
    onClick: PropTypes.func.isRequired,
};

function VisualizerLeftBar(
    {
        pageMode,
        setPageMode,
        setTransformMode,
        updateBoundingBox,
        autoRotateSelectedModel,
        arrangeAllModels,
        setHoverFace,
        fitViewIn,
        handleApplySimplify,
        handleCancelSimplify,
        handleUpdateSimplifyConfig,
        handleCheckModelLocation,
    }
) {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const models = useSelector(state => state?.printing?.modelGroup.models);
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);

    const toolHead = useSelector((state) => state.machine.toolHead);
    const { printingToolhead } = toolHead;
    const isDual = isDualExtruder(printingToolhead);

    const qualityDefinitions = useSelector(state => state.printing.qualityDefinitions);
    const canOpenMeshFile = useMemo(() => {
        return qualityDefinitions.length > 0;
    }, [qualityDefinitions]);

    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);

    const dispatch = useDispatch();
    const fileInput = useRef(null);
    const actions = {
        onClickToUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onChangeFile: async (event) => {
            const files = event.target.files;
            // try {
            await dispatch(printingActions.uploadModel(files));
            // } catch (e) {
            //     modal({
            //         title: i18n._('key-Printing/LeftBar-Failed to upload model.'),
            //         body: e.message || e.body.msg
            //     });
            // }
        },
        onModelAfterTransform: () => {
            dispatch(printingActions.onModelAfterTransform());
            updateBoundingBox();

            handleCheckModelLocation();
        },
        importFile: (fileObj) => {
            if (fileObj) {
                actions.onChangeFile({
                    target: {
                        files: Array.isArray(fileObj) ? fileObj : [fileObj]
                    }
                });
            } else {
                actions.onClickToUpload();
            }
        },
        rotateWithAnalysis: () => {
            actions.rotateOnlyForUniformScale(() => {
                dispatch(printingActions.startAnalyzeRotationProgress());
                setTimeout(() => {
                    fitViewIn && fitViewIn();
                    setShowRotationAnalyzeModal(true);
                }, 100);
            });
            logTransformOperation(HEAD_PRINTING, 'roate', 'analyze_in');
        },
        rotateOnlyForUniformScale: (rotateFn) => {
            if (actions.isNonUniformScaled()) {
                modal({
                    cancelTitle: i18n._('key-Modal/Common-OK'),
                    title: i18n._('key-Printing/Rotation-error title'),
                    body: i18n._('key-Printing/Rotation-error tips')
                });
            } else {
                rotateFn && rotateFn();
            }
        },
        isNonUniformScaled: () => {
            if (selectedModelArray.length === 1) {
                if (selectedModelArray[0] instanceof ThreeGroup) {
                    return selectedModelArray[0].children.some(modelItem => {
                        const { scaleX, scaleY, scaleZ } = modelItem.transformation;
                        return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
                            || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
                            || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
                    });
                } else {
                    return false;
                }
            }
            return selectedModelArray.some(modelItem => {
                const { scaleX, scaleY, scaleZ } = modelItem.transformation;
                return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
                    || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
                    || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
            });
        },
    };

    /**
     * Enter "Edit Support" page mode.
     */
    const enterEditSupportPageMode = useCallback(() => {
        dispatch(printingActions.exitPreview());

        // In preview mode, wait for modelGroup.object.parent recovery
        setTimeout(() => {
            // fit camera to target model
            fitViewIn && fitViewIn();

            // show
            setPageMode(PageMode.EditSupport);

            logTransformOperation(HEAD_PRINTING, 'support', 'edit_in');
        });
    }, [dispatch, fitViewIn, setPageMode]);

    /**
     * Enter "Mesh Coloring" page mode.
     */
    const enterMeshColoringPageMode = useCallback(() => {
        dispatch(printingActions.exitPreview());

        // In preview mode, wait for modelGroup.object.parent recovery
        // show
        setPageMode(PageMode.MeshColoring);

        // fit camera to target model
        setTimeout(() => {
            fitViewIn && fitViewIn();
        }, 50);
    }, [dispatch, fitViewIn, setPageMode]);


    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.import', actions.importFile);
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, [actions.importFile]);

    const hasVisableModels = models.some(model => model.visible && !(model instanceof PrimeTowerModel));
    const hasAnyVisableModels = models.some(model => model.visible);
    const isSingleMeshSelected = selectedModelArray.length === 1 && selectedModelArray[0] instanceof ThreeModel;

    // const hasModels = modelGroup.getModels().some(model => !(model instanceof PrimeTowerModel));

    // In certain page mode, other operations are disabled
    const pageModeDisabled = [
        PageMode.Simplify,
        PageMode.Support,
        PageMode.EditSupport,
        PageMode.MeshColoring,
    ].includes(pageMode);

    const moveDisabled = showRotationAnalyzeModal || !hasAnyVisableModels || pageModeDisabled;
    const scaleDisabled = showRotationAnalyzeModal || !hasAnyVisableModels || pageModeDisabled;
    const rotateDisabled = showRotationAnalyzeModal || !hasVisableModels || isPrimeTowerSelected || pageModeDisabled;
    const mirrorDisabled = showRotationAnalyzeModal || !hasVisableModels || isPrimeTowerSelected || pageModeDisabled;
    const supportDisabled = showRotationAnalyzeModal || !hasVisableModels || isPrimeTowerSelected || pageModeDisabled;

    const meshColoringDisplay = isDual;
    const meshColoringDisabled = showRotationAnalyzeModal || !hasVisableModels || isPrimeTowerSelected || pageModeDisabled || !isSingleMeshSelected;

    return (
        <div className={styles['visualizer-left-bar']}>
            <input
                ref={fileInput}
                type="file"
                accept=".stl, .obj, .3mf, .amf"
                className="display-none"
                multiple
                onChange={actions.onChangeFile}
            />
            <div className="position-absolute height-percent-100 border-radius-8 background-color-white width-56 box-shadow-module">
                <nav className={styles.navbar}>
                    <ul className={classNames(styles.nav, 'border-bottom-normal')}>
                        <li
                            className="margin-vertical-4"
                        >
                            <SvgIcon
                                type={['hoverSpecial', 'pressSpecial']}
                                name="ToolbarOpen"
                                className="padding-horizontal-4 print-tool-bar-open"
                                disabled={!enableShortcut || !canOpenMeshFile}
                                onClick={() => {
                                    actions.onClickToUpload();
                                }}
                                size={48}
                                color="#545659"
                            />
                        </li>
                    </ul>
                    <span className="print-intro-three">
                        <ul className={classNames(styles.nav, 'border-bottom-normal')}>
                            <li className="margin-vertical-4">
                                <SvgIcon
                                    color="#545659"
                                    className={classNames(
                                        { [styles.selected]: (!moveDisabled && transformMode === 'translate') },
                                        'padding-horizontal-4'
                                    )}
                                    type={[`${!moveDisabled && transformMode === 'translate' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                    name="ToolbarMove"
                                    size={48}
                                    onClick={() => {
                                        setTransformMode('translate');
                                    }}
                                    disabled={moveDisabled}
                                />
                            </li>
                            <li className="margin-vertical-4">
                                <SvgIcon
                                    color="#545659"
                                    className={classNames(
                                        { [styles.selected]: (!scaleDisabled && transformMode === 'scale') },
                                        'padding-horizontal-4'
                                    )}
                                    type={[`${!scaleDisabled && transformMode === 'scale' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                    name="ToolbarScale"
                                    size={48}
                                    onClick={() => {
                                        setTransformMode('scale');
                                    }}
                                    disabled={scaleDisabled}
                                />
                            </li>
                            <li className="margin-vertical-4">
                                <SvgIcon
                                    color="#545659"
                                    className={classNames(
                                        { [styles.selected]: (!rotateDisabled && transformMode === 'rotate') },
                                        'padding-horizontal-4'
                                    )}
                                    type={[`${!rotateDisabled && transformMode === 'rotate' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                    name="ToolbarRotate"
                                    size={48}
                                    onClick={() => {
                                        setTransformMode('rotate');
                                    }}
                                    // disabled={!!(transformDisabled || isPrimeTowerSelected)}
                                    disabled={rotateDisabled}
                                />
                            </li>
                            <li className="margin-vertical-4">
                                <SvgIcon
                                    color="#545659"
                                    className={classNames(
                                        { [styles.selected]: (!mirrorDisabled && transformMode === 'mirror') },
                                        'padding-horizontal-4'
                                    )}
                                    type={[`${!mirrorDisabled && transformMode === 'mirror' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                    name="ToolbarMirror"
                                    size={48}
                                    onClick={() => {
                                        setTransformMode('mirror');
                                    }}
                                    disabled={mirrorDisabled}
                                />
                            </li>
                        </ul>
                        <ul className={classNames(styles.nav)}>
                            <li className="margin-vertical-4">
                                <SvgIcon
                                    name="ToolbarSupport"
                                    color="#545659"
                                    className={classNames(
                                        'padding-horizontal-4',
                                        {
                                            [styles.selected]: (pageMode === PageMode.Support)
                                        },
                                    )}
                                    type={[`${pageMode === PageMode.Support ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                    size={48}
                                    onClick={() => setPageMode(PageMode.Support)}
                                    disabled={supportDisabled}
                                />
                            </li>
                            {
                                meshColoringDisplay && (
                                    <li className="margin-vertical-4">
                                        <SvgIcon
                                            name="ToolbarColorBrush"
                                            color="#545659"
                                            className={classNames(
                                                'padding-horizontal-4',
                                                {
                                                    [styles.selected]: (pageMode === PageMode.MeshColoring)
                                                },
                                            )}
                                            type={[`${pageMode === PageMode.MeshColoring ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                            size={48}
                                            onClick={enterMeshColoringPageMode}
                                            disabled={meshColoringDisabled}
                                        />
                                    </li>
                                )
                            }
                        </ul>
                    </span>
                </nav>
            </div>
            {
                !moveDisabled && transformMode === 'translate' && (
                    <TranslateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        arrangeAllModels={arrangeAllModels}
                        transformDisabled={moveDisabled}
                        size={size}
                        hasModels={hasVisableModels}
                    />
                )
            }
            {
                !scaleDisabled && transformMode === 'scale' && (
                    <ModelScaleOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        size={size}
                    />
                )
            }
            {
                showRotationAnalyzeModal && (
                    <RotationAnalysisOverlay onClose={() => {
                        setShowRotationAnalyzeModal(false);
                    }}
                    />
                )
            }
            {
                !rotateDisabled && transformMode === 'rotate' && (
                    <RotateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        rotateWithAnalysis={actions.rotateWithAnalysis}
                        autoRotateSelectedModel={autoRotateSelectedModel}
                        modelGroup={modelGroup}
                        hasModels={hasVisableModels}
                        setHoverFace={setHoverFace}
                        transformDisabled={rotateDisabled}
                    />
                )
            }

            {
                !mirrorDisabled && transformMode === 'mirror' && (
                    <MirrorOverlay
                        setTransformMode={setTransformMode}
                        updateBoundingBox={updateBoundingBox}
                    />
                )
            }

            {/* Support Config */
                pageMode === PageMode.Support && (
                    <SupportOverlay
                        enterEditSupportPageMode={enterEditSupportPageMode}
                        onClose={() => setPageMode(PageMode.Default)}
                    />
                )
            }

            {/* Edit Support */
                pageMode === PageMode.EditSupport && (
                    <EditSupportOverlay
                        onClose={() => {
                            // switch back to support mode
                            setPageMode(PageMode.Support);
                        }}
                    />
                )
            }

            {/* Mesh Coloring */
                pageMode === PageMode.MeshColoring && (
                    <MeshColoringOverlay
                        onClose={() => {
                            // switch back to default mode
                            setPageMode(PageMode.Default);
                        }}
                    />
                )
            }

            {/* Simplify Model */
                pageMode === PageMode.Simplify && (
                    <SimplifyModelOverlay
                        handleApplySimplify={handleApplySimplify}
                        handleCancelSimplify={handleCancelSimplify}
                        handleUpdateSimplifyConfig={handleUpdateSimplifyConfig}
                    />
                )
            }

            {/* Change Print Mode */
                pageMode === PageMode.ChangePrintMode && (
                    <ChangePrintModeOverlay
                        onClose={() => setPageMode(PageMode.Default)}
                    />
                )
            }
        </div>
    );
}

VisualizerLeftBar.propTypes = {
    autoRotateSelectedModel: PropTypes.func.isRequired,
    setTransformMode: PropTypes.func.isRequired,
    updateBoundingBox: PropTypes.func.isRequired,
    arrangeAllModels: PropTypes.func.isRequired,
    setHoverFace: PropTypes.func.isRequired,
    fitViewIn: PropTypes.func.isRequired,
    pageMode: PropTypes.string.isRequired,
    setPageMode: PropTypes.func.isRequired,
    handleApplySimplify: PropTypes.func,
    handleCancelSimplify: PropTypes.func,
    handleUpdateSimplifyConfig: PropTypes.func,
    handleCheckModelLocation: PropTypes.func
};

export default React.memo(VisualizerLeftBar);
