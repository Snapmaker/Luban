import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import modal from '../../../lib/modal';
import SvgIcon from '../../components/SvgIcon';
import RotationAnalysisOverlay from './Overlay/RotationAnalysisOverlay';
import EditSupportOverlay from './Overlay/EditSupportOverlay';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, EPSILON, HEAD_PRINTING } from '../../../constants';
import { machineStore } from '../../../store/local-storage';
// import TipTrigger from '../../components/TipTrigger';
import PrimeTowerModel from '../../../models/PrimeTowerModel';
/* eslint-disable-next-line import/no-cycle */
import SupportOverlay from './Overlay/SupportOverlay';
/* eslint-disable-next-line import/no-cycle */
import TranslateOverlay from './Overlay/TranslateOverlay';
/* eslint-disable-next-line import/no-cycle */
import ScaleOverlay from './Overlay/ScaleOverlay';
/* eslint-disable-next-line import/no-cycle */
import RotateOverlay from './Overlay/RotateOverlay';
/* eslint-disable-next-line import/no-cycle */
import ExtruderOverlay from './Overlay/ExtruderOverlay';
/* eslint-disable-next-line import/no-cycle */
import MirrorOverlay from './Overlay/MirrorOverlay';
import SimplifyModelOverlay from './Overlay/SimplifyOverlay';
import { logTransformOperation } from '../../../lib/gaEvent';

export const whiteHex = '#ffffff';
export const renderExtruderIcon = (leftExtruderColor, rightExtruderColor) => (
    <div className="position-re width-24">
        {leftExtruderColor !== whiteHex ? (
            <SvgIcon
                color={leftExtruderColor}
                size={24}
                name="ExtruderLeft"
                type={['static']}
                className="position-ab"
            />
        ) : (
            <img className="position-ab" src="/resources/images/24x24/icon_extruder_white_left_24x24.svg" alt="" />
        )}
        {rightExtruderColor !== whiteHex ? (
            <SvgIcon
                color={rightExtruderColor}
                size={24}
                name="ExtruderRight"
                type={['static']}
                className="position-ab right-1"
            />
        ) : (
            <img src="/resources/images/24x24/icon_extruder_white_right_24x24.svg" alt="" className="position-ab" />
        )}
    </div>
);
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
function VisualizerLeftBar({ setTransformMode, supportActions, updateBoundingBox,
    autoRotateSelectedModel, arrangeAllModels, setHoverFace, fitViewIn, simplifying, handleApplySimplify,
    handleCancelSimplify, handleUpdateSimplifyConfig }) {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const models = useSelector(state => state?.printing?.modelGroup.models);
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);
    const [showEditSupportModal, setShowEditSupportModal] = useState(false);
    const isDualExtruder = machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
    const dispatch = useDispatch();
    const fileInput = useRef(null);
    const actions = {
        onClickToUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onChangeFile: async (event) => {
            const files = event.target.files;
            try {
                await dispatch(printingActions.uploadModel(files));
            } catch (e) {
                modal({
                    title: i18n._('key-Printing/LeftBar-Failed to upload model.'),
                    body: e.message
                });
            }
        },
        onModelAfterTransform: () => {
            dispatch(printingActions.onModelAfterTransform());
            updateBoundingBox();
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
            supportActions.stopSupportMode();
            actions.rotateOnlyForUniformScale(() => {
                dispatch(printingActions.startAnalyzeRotationProgress());
                setTimeout(() => {
                    setShowRotationAnalyzeModal(true);
                    fitViewIn && fitViewIn();
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
        editSupport: useCallback(() => {
            fitViewIn && fitViewIn();
            modelGroup.selectAllModels();
            setShowEditSupportModal(true);
        }, [setShowEditSupportModal, fitViewIn]),
        isNonUniformScaled: () => {
            const { scaleX, scaleY, scaleZ } = selectedModelArray[0].transformation;
            return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
                || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
                || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
        },
    };

    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.import', actions.importFile);
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, [actions.importFile]);

    const hasVisableModels = models.some(model => model.visible && !(model instanceof PrimeTowerModel));
    const hasAnyVisableModels = models.some(model => model.visible);

    // const hasModels = modelGroup.getModels().some(model => !(model instanceof PrimeTowerModel));
    const moveDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasAnyVisableModels || simplifying;
    const scaleDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasAnyVisableModels || simplifying;
    const rotateDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasVisableModels || isPrimeTowerSelected || simplifying;
    const mirrorDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasVisableModels || isPrimeTowerSelected || simplifying;
    const supportDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasVisableModels || isPrimeTowerSelected || simplifying;
    const extruderDisabled = showRotationAnalyzeModal || showEditSupportModal || !hasVisableModels || isPrimeTowerSelected || simplifying;

    return (
        <React.Fragment>
            <div className={styles['visualizer-left-bar']}>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".stl, .obj"
                    className="display-none"
                    multiple
                    onChange={actions.onChangeFile}
                />
                <div className="position-ab height-percent-100 border-radius-8 background-color-white width-56 box-shadow-module">
                    <nav className={styles.navbar}>
                        <ul className={classNames(styles.nav, 'border-bottom-normal')}>
                            <li
                                className="margin-vertical-4"
                            >
                                <SvgIcon
                                    type={['hoverSpecial', 'pressSpecial']}
                                    name="ToolbarOpen"
                                    className="padding-horizontal-4 print-tool-bar-open"
                                    disabled={!enableShortcut}
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
                                <li
                                    className="margin-vertical-4"
                                >
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
                                <li
                                    className="margin-vertical-4"
                                >
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
                                <li
                                    className="margin-vertical-4"
                                >
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
                                <li
                                    className="margin-vertical-4"
                                >
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
                                <li
                                    className="margin-vertical-4"
                                >
                                    <SvgIcon
                                        color="#545659"
                                        className={classNames(
                                            { [styles.selected]: (!supportDisabled && transformMode === 'support') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!supportDisabled && transformMode === 'support' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarSupport"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('support');
                                        }}
                                        disabled={supportDisabled}
                                    />
                                </li>
                                {isDualExtruder && (
                                    <li className="margin-vertical-4">
                                        <SvgIcon
                                            color="#545659"
                                            className={classNames(
                                                { [styles.selected]: (!extruderDisabled && transformMode === 'extruder') },
                                                'padding-horizontal-4'
                                            )}
                                            type={[`${!extruderDisabled && transformMode === 'extruder' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                            name="ToolbarExtruder"
                                            size={48}
                                            onClick={() => {
                                                setTransformMode('extruder');
                                                !selectedModelArray.length && dispatch(printingActions.selectAllModels());
                                            }}
                                            disabled={!!extruderDisabled}
                                        />
                                    </li>
                                )}
                            </ul>
                        </span>
                    </nav>
                </div>
                {!moveDisabled && transformMode === 'translate' && (
                    <TranslateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        arrangeAllModels={arrangeAllModels}
                        transformDisabled={moveDisabled}
                        size={size}
                        hasModels={hasVisableModels}
                    />
                )}
                {!scaleDisabled && transformMode === 'scale' && (
                    <ScaleOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        size={size}
                    />
                )}
                {showRotationAnalyzeModal && <RotationAnalysisOverlay onClose={() => { setShowRotationAnalyzeModal(false); }} />}
                {!rotateDisabled && transformMode === 'rotate' && (
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
                )}

                {!mirrorDisabled && transformMode === 'mirror' && (
                    <MirrorOverlay
                        setTransformMode={setTransformMode}
                        updateBoundingBox={updateBoundingBox}
                    />
                )}

                {showEditSupportModal && <EditSupportOverlay onClose={() => { setShowEditSupportModal(false); }} />}

                {simplifying && <SimplifyModelOverlay handleApplySimplify={handleApplySimplify} handleCancelSimplify={handleCancelSimplify} handleUpdateSimplifyConfig={handleUpdateSimplifyConfig} />}
                {!supportDisabled && transformMode === 'support' && <SupportOverlay setTransformMode={setTransformMode} editSupport={() => { actions.editSupport(); }} />}

                {!extruderDisabled && transformMode === 'extruder' && isDualExtruder && (
                    <ExtruderOverlay setTransformMode={setTransformMode} />
                )}
            </div>
        </React.Fragment>
    );
}
VisualizerLeftBar.propTypes = {
    supportActions: PropTypes.object,
    autoRotateSelectedModel: PropTypes.func.isRequired,
    setTransformMode: PropTypes.func.isRequired,
    updateBoundingBox: PropTypes.func.isRequired,
    arrangeAllModels: PropTypes.func.isRequired,
    setHoverFace: PropTypes.func.isRequired,
    fitViewIn: PropTypes.func.isRequired,
    simplifying: PropTypes.bool,
    handleApplySimplify: PropTypes.func,
    handleCancelSimplify: PropTypes.func,
    handleUpdateSimplifyConfig: PropTypes.func
};

export default React.memo(VisualizerLeftBar);
