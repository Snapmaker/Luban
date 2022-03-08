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
import SupportOverlay from './Overlay/SupportOverlay';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_PRINTING,
    EPSILON, BOTH_EXTRUDER_MAP_NUMBER, LEFT_EXTRUDER_MAP_NUMBER } from '../../../constants';
import { machineStore } from '../../../store/local-storage';
// import TipTrigger from '../../components/TipTrigger';
import PrimeTowerModel from '../../../models/PrimeTowerModel';
/* eslint-disable-next-line import/no-cycle */
import TranslateOverlay from './Overlay/translateOverlay';
/* eslint-disable-next-line import/no-cycle */
import ScaleOverlay from './Overlay/scaleOverlay';
/* eslint-disable-next-line import/no-cycle */
import RotateOverlay from './Overlay/rotateOverlay';
/* eslint-disable-next-line import/no-cycle */
import ExtruderOverlay from './Overlay/extruderOverlay';
/* eslint-disable-next-line import/no-cycle */
import MirrorOverlay from './Overlay/mirrorOverlay';

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
function VisualizerLeftBar({ setTransformMode, supportActions, updateBoundingBox, autoRotateSelectedModel }) {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);
    const [showEditSupportModal, setShowEditSupportModal] = useState(false);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const hasModels = modelGroup.getModels().some(model => model.visible && !(model instanceof PrimeTowerModel));
    const supportDisabled = (displayedType !== 'model' || modelGroup.getModelsAttachedSupport(false).length === 0);
    const isDualExtruder = machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
    const [dualExtruderDisabled, setDualExtruderDisabled] = useState(!models.length);
    const dispatch = useDispatch();
    const fileInput = useRef(null);

    const actions = {
        onClickToUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await dispatch(printingActions.uploadModel(file));
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
                        files: [fileObj]
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
                }, 100);
            });
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
            setShowEditSupportModal(true);
        }, [setShowEditSupportModal]),
        isNonUniformScaled: () => {
            const { scaleX, scaleY, scaleZ } = selectedModelArray[0].transformation;
            return Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > EPSILON
                || Math.abs(Math.abs(scaleX) - Math.abs(scaleZ)) > EPSILON
                || Math.abs(Math.abs(scaleY) - Math.abs(scaleZ)) > EPSILON;
        },
    };
    // TODO: refactor these flags
    const transformDisabled = showRotationAnalyzeModal || showEditSupportModal || !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));
    // TODO

    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.import', actions.importFile);
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        if (!models.length) {
            setDualExtruderDisabled(true);
        } else if (models.length && !selectedModelArray.length) {
            for (const model of models) {
                if (model.visible) {
                    setDualExtruderDisabled(false);
                    break;
                } else {
                    !dualExtruderDisabled && setDualExtruderDisabled(true);
                }
            }
        }
    }, [models.length, models]);

    return (
        <React.Fragment>
            <div className={styles['visualizer-left-bar']}>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".stl, .obj"
                    className="display-none"
                    multiple={false}
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
                                            { [styles.selected]: (!showRotationAnalyzeModal && transformMode === 'translate') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!showRotationAnalyzeModal && transformMode === 'translate' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarMove"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('translate');
                                        }}
                                        disabled={showRotationAnalyzeModal || !hasModels || transformDisabled}
                                    />
                                </li>
                                <li
                                    className="margin-vertical-4"
                                >
                                    <SvgIcon
                                        color="#545659"
                                        className={classNames(
                                            { [styles.selected]: (!transformDisabled && transformMode === 'scale') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!transformDisabled && transformMode === 'scale' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarScale"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('scale');
                                        }}
                                        disabled={!!transformDisabled}
                                    />
                                </li>
                                <li
                                    className="margin-vertical-4"
                                >
                                    <SvgIcon
                                        color="#545659"
                                        className={classNames(
                                            { [styles.selected]: (!transformDisabled && transformMode === 'rotate') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!transformDisabled && transformMode === 'rotate' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarRotate"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('rotate');
                                        }}
                                        // disabled={!!(transformDisabled || isPrimeTowerSelected)}
                                        disabled={!hasModels}
                                    />
                                </li>
                                <li
                                    className="margin-vertical-4"
                                >
                                    <SvgIcon
                                        color="#545659"
                                        className={classNames(
                                            { [styles.selected]: (!transformDisabled && transformMode === 'mirror') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!transformDisabled && transformMode === 'mirror' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarMirror"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('mirror');
                                        }}
                                        disabled={!!(transformDisabled || isPrimeTowerSelected)}
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
                                        type={[`${transformMode === 'support' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarSupport"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('support');
                                        }}
                                        disabled={!!(!hasModels || supportDisabled || isPrimeTowerSelected)}
                                    />
                                </li>
                                {isDualExtruder && (
                                    <li className="margin-vertical-4">
                                        <SvgIcon
                                            color="#545659"
                                            className={classNames(
                                                { [styles.selected]: (!transformDisabled && transformMode === 'extruder') },
                                                'padding-horizontal-4'
                                            )}
                                            type={[`${!transformDisabled && transformMode === 'extruder' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                            name="ToolbarExtruder"
                                            size={48}
                                            onClick={() => {
                                                setTransformMode('extruder');
                                                !selectedModelArray.length && dispatch(printingActions.selectAllModels());
                                            }}
                                            disabled={Boolean(dualExtruderDisabled)}
                                        />
                                    </li>
                                )}
                            </ul>
                        </span>
                    </nav>
                </div>
                {!showRotationAnalyzeModal && transformMode === 'translate' && (
                    <TranslateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        arrangeAllModels={arrangeAllModels}
                        transformDisabled={transformDisabled}
                        size={size}
                        hasModels={hasModels}
                    />
                )}
                {!transformDisabled && transformMode === 'scale' && (
                    <ScaleOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        size={size}
                    />
                )}
                {showRotationAnalyzeModal && <RotationAnalysisOverlay onClose={() => { setShowRotationAnalyzeModal(false); }} />}
                {hasModels && transformMode === 'rotate' && !isPrimeTowerSelected && (
                    <RotateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        rotateWithAnalysis={actions.rotateWithAnalysis}
                        autoRotateSelectedModel={autoRotateSelectedModel}
                        modelGroup={modelGroup}
                        hasModels={hasModels}
                    />
                )}

                {!transformDisabled && transformMode === 'mirror' && !isPrimeTowerSelected && (
                    <MirrorOverlay
                        setTransformMode={setTransformMode}
                        updateBoundingBox={updateBoundingBox}
                    />
                )}

                {showEditSupportModal && <EditSupportOverlay onClose={() => { setShowEditSupportModal(false); }} />}
                {!supportDisabled && !showEditSupportModal && transformMode === 'support' && <SupportOverlay editSupport={() => { actions.editSupport(); }} />}
                {!transformDisabled && transformMode === 'extruder' && isDualExtruder && (
                    <ExtruderOverlay setTransformMode={setTransformMode} setDualExtruderDisabled={setDualExtruderDisabled} />
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
};

export default React.memo(VisualizerLeftBar);
