import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import * as THREE from 'three';
import { cloneDeep, filter, find } from 'lodash';
import i18n from '../../../lib/i18n';
// import { toFixed } from '../../../lib/numeric-utils';
import UniApi from '../../../lib/uni-api';
// import { NumberInput as Input } from '../../components/Input';
// import Select from '../../components/Select';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
// import { actions as machineActions } from '../../../flux/machine';
import modal from '../../../lib/modal';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
// import Checkbox from '../../components/Checkbox';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import RotationAnalysisOverlay from './Overlay/RotationAnalysisOverlay';
import EditSupportOverlay from './Overlay/EditSupportOverlay';
import SupportOverlay from './Overlay/SupportOverlay';
import TranslateOverlay from './Overlay/TranslationOverlay';
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

const extruderLabelMap = {
    '0': 'Extruder L',
    '1': 'Extruder R',
    '2': 'Extruder Both'
};
const originalModelsExtruder = {
    multiple: LEFT_EXTRUDER_MAP_NUMBER,
    infill: LEFT_EXTRUDER_MAP_NUMBER,
    shell: LEFT_EXTRUDER_MAP_NUMBER
};
const originalHelpersExtruder = {
    multiple: LEFT_EXTRUDER_MAP_NUMBER,
    support: LEFT_EXTRUDER_MAP_NUMBER,
    adhesion: LEFT_EXTRUDER_MAP_NUMBER
};
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
    // const printingArrangeSettings = useSelector(state => state?.machine?.printingArrangeSettings, shallowEqual);
    // const selectedGroup = useSelector(state => state?.printing?.modelGroup?.selectedGroup, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    // const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const helpersExtruderConfig = useSelector(state => state?.printing?.helpersExtruderConfig);
    const { isOpenSelectModals, isOpenHelpers: _isOpenHelpers, modelExtruderInfoShow, helpersExtruderInfoShow } = useSelector(state => state?.printing);
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup?.isSupportSelected());
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);
    const [showEditSupportModal, setShowEditSupportModal] = useState(false);
    const [modelsExtruder, setModelsExtruder] = useState(originalModelsExtruder);
    const [helpersExtrurder, setHelpersExtruder] = useState(helpersExtruderConfig || originalHelpersExtruder);
    const [isOpenModels, setIsOpenModels] = useState(isOpenSelectModals);
    const [isOpenHelpers, setIsOpenHelpers] = useState(_isOpenHelpers);
    // const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxWHD(), shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    // const colorL = '#FF8B00';
    // const colorR = '#0053AA';
    const [colorL, setColorL] = useState(whiteHex);
    const [colorR, setColorR] = useState(whiteHex);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
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
        mirrorSelectedModel: (value) => {
            switch (value) {
                case 'X':
                    dispatch(printingActions.updateSelectedModelTransformation({
                        scaleX: transformation.scaleX * -1
                    }, false));
                    break;
                case 'Y':
                    dispatch(printingActions.updateSelectedModelTransformation({
                        scaleY: transformation.scaleY * -1
                    }, false));
                    break;
                case 'Z':
                    dispatch(printingActions.updateSelectedModelTransformation({
                        scaleZ: transformation.scaleZ * -1
                    }, false));
                    break;
                case 'Reset':
                    dispatch(printingActions.updateSelectedModelTransformation({
                        scaleX: Math.abs(transformation.scaleX),
                        scaleY: Math.abs(transformation.scaleY),
                        scaleZ: Math.abs(transformation.scaleZ)
                    }, false));
                    break;
                default:
                    break;
            }
            updateBoundingBox();
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
        onChangeExtruder: (type, direction) => {
            const typeArr = type.split('.');
            switch (typeArr[1]) {
                case 'multiple':
                    if (typeArr[0] === 'models') {
                        const newModelsExtruder = cloneDeep(modelsExtruder);
                        Object.keys(newModelsExtruder).forEach(key => {
                            newModelsExtruder[key] = direction;
                        });
                        setModelsExtruder(newModelsExtruder);
                        dispatch(printingActions.updateSelectedModelsExtruder({ infill: direction, shell: direction }));
                    } else {
                        const newHelpersExtruder = cloneDeep(helpersExtrurder);
                        Object.keys(newHelpersExtruder).forEach(key => {
                            newHelpersExtruder[key] = direction;
                        });
                        setHelpersExtruder(newHelpersExtruder);
                        dispatch(printingActions.updateHelpersExtruder({ support: direction, adhesion: direction }));
                    }
                    break;
                case 'infill':
                    setModelsExtruder({
                        ...modelsExtruder,
                        infill: direction,
                        multiple: modelsExtruder.shell === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                    });
                    dispatch(printingActions.updateSelectedModelsExtruder({ infill: direction, shell: modelsExtruder.shell }));
                    break;
                case 'shell':
                    setModelsExtruder({
                        ...modelsExtruder,
                        shell: direction,
                        multiple: modelsExtruder.infill === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                    });
                    dispatch(printingActions.updateSelectedModelsExtruder({ shell: direction, infill: modelsExtruder.infill }));
                    break;
                case 'adhesion':
                    setHelpersExtruder({
                        ...helpersExtrurder,
                        adhesion: direction,
                        multiple: helpersExtrurder.support === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                    });
                    dispatch(printingActions.updateHelpersExtruder({ support: helpersExtrurder.support, adhesion: direction }));
                    break;
                case 'support':
                    setHelpersExtruder({
                        ...helpersExtrurder,
                        support: direction,
                        multiple: helpersExtrurder.adhesion === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                    });
                    dispatch(printingActions.updateHelpersExtruder({ adhesion: helpersExtrurder.adhesion, support: direction }));
                    break;
                default:
                    break;
            }
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        handleOpen: (type) => {
            let temp = null;
            switch (type) {
                case 'models':
                    temp = !isOpenModels;
                    setIsOpenModels(temp);
                    dispatch(printingActions.updateState({ isOpenSelectModals: temp }));
                    break;
                case 'helpers':
                    temp = !isOpenHelpers;
                    setIsOpenHelpers(temp);
                    dispatch(printingActions.updateState({ isOpenHelpers: temp }));
                    break;
                default:
                    break;
            }
        }
    };
    let moveX = 0;
    let moveY = 0;
    let scaleXPercent = 100;
    let scaleYPercent = 100;
    let scaleZPercent = 100;
    let rotateX = 0;
    let rotateY = 0;
    let rotateZ = 0;
    let uniformScalingState = true;
    // TODO: refactor these flags
    const transformDisabled = showRotationAnalyzeModal || showEditSupportModal || !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));
    // TODO
    const hasModels = modelGroup.getModels().some(model => model.visible && !(model instanceof PrimeTowerModel));
    const supportDisabled = (displayedType !== 'model' || modelGroup.getModelsAttachedSupport(false).length === 0);
    const rotationAnalysisEnable = (selectedModelArray.length === 1 && selectedModelArray[0].visible && !selectedModelArray[0].parent);
    const isDualExtruder = machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
    const [dualExtruderDisabled, setDualExtruderDisabled] = useState(!models.length);
    if (selectedModelArray.length >= 1) {
        moveX = Number(toFixed(transformation.positionX, 1));
        moveY = Number(toFixed(transformation.positionY, 1));
        rotateX = Number(toFixed(THREE.Math.radToDeg(transformation.rotationX), 1));
        rotateY = Number(toFixed(THREE.Math.radToDeg(transformation.rotationY), 1));
        rotateZ = Number(toFixed(THREE.Math.radToDeg(transformation.rotationZ), 1));
        scaleXPercent = Number(toFixed((Math.abs(transformation.scaleX) * 100), 1));
        scaleYPercent = Number(toFixed((Math.abs(transformation.scaleY) * 100), 1));
        scaleZPercent = Number(toFixed((Math.abs(transformation.scaleZ) * 100), 1));
        uniformScalingState = transformation.uniformScalingState;
    }

    const extruderOverlay = (type) => (
        <Menu>
            <Menu.Item
                onClick={() => actions.onChangeExtruder(type, '0')}
                key="L"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder L')}</span>
                    {colorL !== whiteHex ? (
                        <SvgIcon
                            name="Extruder"
                            size={24}
                            color={colorL}
                            type={['static']}
                        />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
            <Menu.Item
                onClick={() => actions.onChangeExtruder(type, '1')}
                key="R"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder R')}</span>
                    {colorR !== whiteHex ? (
                        <SvgIcon
                            name="Extruder"
                            size={24}
                            color={colorR}
                            type={['static']}
                        />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
        </Menu>
    );
    const renderExtruderStatus = (status) => {
        const leftExtruderColor = status === '1' ? colorR : colorL;
        const rightExtruderColor = status === '0' ? colorL : colorR;
        return (
            <div className="sm-flex justify-space-between margin-left-16 width-160 border-default-black-5 border-radius-8 padding-vertical-4 padding-left-8">
                <span className="text-overflow-ellipsis">{i18n._(`key-Printing/LeftBar-${extruderLabelMap[status]}`)}</span>
                <div className="sm-flex">
                    {renderExtruderIcon(leftExtruderColor, rightExtruderColor)}
                    <SvgIcon
                        type={['static']}
                        size={24}
                        hoversize={24}
                        color="#545659"
                        name="DropdownOpen"
                    />
                </div>
            </div>
        );
    };
    const renderRotationAnalyzeModal = () => {
        return (
            <RotationAnalysisOverlay onClose={() => { setShowRotationAnalyzeModal(false); }} />
        );
    };
    const renderEditSupportModal = () => {
        return (
            <EditSupportOverlay onClose={() => { setShowEditSupportModal(false); }} />
        );
    };
    const renderSupportOverlay = () => {
        return (
            <SupportOverlay
                editSupport={() => { actions.editSupport(); }}
                CancelButton={CancelButton}
                setTransformMode={setTransformMode}
            />
        );
    };
    const renderTranslateOverlay = () => {
        return (
            <TranslateOverlay
                actions={actions}
                setTransformMode={setTransformMode}
                transformDisabled={transformDisabled}
                moveX={moveX}
                moveY={moveY}
                CancelButton={CancelButton}
                hasModels={hasModels}
            />
        );
    };

    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.import', actions.importFile);
        let newHelpersExtruder = cloneDeep(helpersExtrurder);
        newHelpersExtruder = {
            ...newHelpersExtruder,
            multiple: newHelpersExtruder.support === newHelpersExtruder.adhesion ? newHelpersExtruder.support : BOTH_EXTRUDER_MAP_NUMBER
        };
        setHelpersExtruder(newHelpersExtruder);
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        let tempInfillExtruder = '';
        let tempShellExtruder = '';
        if (selectedModelArray.length > 0) {
            const selectedHiddenModel = filter(selectedModelArray, { visible: false });
            setDualExtruderDisabled(selectedHiddenModel?.length);
            let extruderConfig = selectedModelArray[0].extruderConfig;
            tempInfillExtruder = extruderConfig.infill;
            tempShellExtruder = extruderConfig.shell;
            if (selectedModelArray.length > 1) {
                for (const item of selectedModelArray.slice(1)) {
                    extruderConfig = item.extruderConfig;
                    if (extruderConfig.infill !== tempInfillExtruder && tempInfillExtruder !== BOTH_EXTRUDER_MAP_NUMBER) {
                        tempInfillExtruder = BOTH_EXTRUDER_MAP_NUMBER;
                    }
                    if (extruderConfig.shell !== tempShellExtruder && tempShellExtruder !== BOTH_EXTRUDER_MAP_NUMBER) {
                        tempShellExtruder = BOTH_EXTRUDER_MAP_NUMBER;
                    }
                    if (tempShellExtruder === BOTH_EXTRUDER_MAP_NUMBER && tempInfillExtruder === BOTH_EXTRUDER_MAP_NUMBER) {
                        break;
                    }
                }
            }
        } else if (!selectedModelArray.length && models.length) {
            const visibleModel = filter(models, { visible: true });
            setDualExtruderDisabled(!visibleModel.length);
        }
        setModelsExtruder({
            multiple: tempInfillExtruder === tempShellExtruder ? tempInfillExtruder : BOTH_EXTRUDER_MAP_NUMBER,
            infill: tempInfillExtruder,
            shell: tempShellExtruder
        });
    }, [selectedModelArray]);

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

    useEffect(() => {
        const leftExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
        const rightExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        const newColorL = leftExtrualMaterial?.settings?.color?.default_value;
        const newColorR = rightExtrualMaterial?.settings?.color?.default_value;
        newColorL && setColorL(newColorL);
        newColorR && setColorR(newColorR);
    }, [materialDefinitions, defaultMaterialIdRight, defaultMaterialId]);

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
                                        disabled={!!(transformDisabled || isSupportSelected || isPrimeTowerSelected)}
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
                                        disabled={!!(transformDisabled || isSupportSelected || isPrimeTowerSelected)}
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
                {!transformDisabled && !isSupportSelected && transformMode === 'scale' && (
                    <ScaleOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        size={size}
                    />
                )}
                {showRotationAnalyzeModal && renderRotationAnalyzeModal()}
                {!transformDisabled && transformMode === 'rotate' && !isPrimeTowerSelected && (
                    <RotateOverlay
                        setTransformMode={setTransformMode}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        rotateWithAnalysis={actions.rotateWithAnalysis}
                        autoRotateSelectedModel={autoRotateSelectedModel}
                    />
                )}

                {!transformDisabled && transformMode === 'mirror' && !isPrimeTowerSelected && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '216px'
                        }}
                    >
                        <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 font-size-middle">
                            {i18n._('key-Printing/LeftBar-Mirror')}
                            <CancelButton
                                onClick={() => setTransformMode('')}
                            />
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex">
                                <Button
                                    className="margin-right-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={() => actions.mirrorSelectedModel('X')}
                                >
                                    <span className="color-red-1">{i18n._('key-Printing/LeftBar-X ')}</span>
                                    <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                                </Button>
                                <Button
                                    className="margin-horizontal-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={() => actions.mirrorSelectedModel('Y')}
                                >
                                    <span className="color-green-1">{i18n._('key-Printing/LeftBar-Y ')}</span>
                                    <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                                </Button>
                                <Button
                                    className="margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={() => actions.mirrorSelectedModel('Z')}
                                >
                                    <span className="color-blue-2">{i18n._('key-Printing/LeftBar-Z ')}</span>
                                    <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {showEditSupportModal && renderEditSupportModal()}
                {!supportDisabled && !showEditSupportModal && transformMode === 'support' && renderSupportOverlay()}
                {!transformDisabled && transformMode === 'extruder' && isDualExtruder && (
                    <div
                        className="position-ab width-328 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '320px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 sm-flex justify-space-between font-size-middle">
                            {i18n._('key-Printing/LeftBar-Extruder')}
                            <CancelButton
                                onClick={() => setTransformMode('')}
                            />
                        </div>
                        <div className="padding-bottom-16 padding-top-8 padding-left-8">
                            <div className="select-models-container">
                                {modelExtruderInfoShow && (
                                    <div className="sm-flex align-center justify-space-between margin-right-16">
                                        <div className="sm-flex align-center">
                                            <SvgIcon
                                                color="#1890FF"
                                                size={24}
                                                type={['static']}
                                                name="WarningTipsTips"
                                                className="margin-vertical-8 margin-right-4"
                                            />
                                            <span className="display-inline width-200 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Selected Models Extruder Info')}</span>
                                        </div>
                                        <SvgIcon
                                            color="#545659"
                                            size={24}
                                            type={['static']}
                                            name="Cancel"
                                            className="margin-right-8"
                                            onClick={() => {
                                                dispatch(printingActions.updateState({ modelExtruderInfoShow: false }));
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="sm-flex align-center margin-top-8">
                                    <SvgIcon
                                        size={24}
                                        hoversize={24}
                                        type={['static']}
                                        name={`${isOpenModels ? 'DropdownOpen' : 'DropdownClose'}`}
                                        color="#545659"
                                        onClick={() => actions.handleOpen('models')}
                                    />
                                    <div role="presentation" onClick={() => actions.handleOpen('models')} className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Selected Models')}</div>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('models.multiple')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(modelsExtruder.multiple)}
                                    </Dropdown>
                                </div>
                                <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenModels ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Shells')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('models.shell')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(modelsExtruder.shell)}
                                    </Dropdown>
                                </div>
                                <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenModels ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Infill')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('models.infill')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(modelsExtruder.infill)}
                                    </Dropdown>
                                </div>
                            </div>
                            <div className="height-1 border-bottom-dashed-grey-1 margin-right-16 margin-left-8 margin-top-16 margin-bottom-8" />
                            <div className="select-models-container">
                                {helpersExtruderInfoShow && (
                                    <div className="sm-flex align-center justify-space-between margin-right-16">
                                        <div className="sm-flex align-center">
                                            <SvgIcon
                                                color="#1890FF"
                                                size={24}
                                                type={['static']}
                                                name="WarningTipsTips"
                                                className="margin-vertical-8 margin-right-4"
                                            />
                                            <span className="display-inline width-200 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Helpers Extruder Info')}</span>
                                        </div>
                                        <SvgIcon
                                            color="#545659"
                                            size={24}
                                            type={['static']}
                                            name="Cancel"
                                            className="margin-right-8"
                                            onClick={() => {
                                                dispatch(printingActions.updateState({ helpersExtruderInfoShow: false }));
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="sm-flex align-center padding-top-8">
                                    <SvgIcon
                                        size={24}
                                        hoversize={24}
                                        type={['static']}
                                        name={`${isOpenHelpers ? 'DropdownOpen' : 'DropdownClose'}`}
                                        color="#545659"
                                        onClick={() => actions.handleOpen('helpers')}
                                    />
                                    <div role="presentation" onClick={() => actions.handleOpen('helpers')} className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-All Helpers')}</div>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.multiple')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExtrurder.multiple)}
                                    </Dropdown>
                                </div>
                                <div className={`align-center margin-left-24 margin-top-8 ${isOpenHelpers ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Adhesion')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.adhesion')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExtrurder.adhesion)}
                                    </Dropdown>
                                </div>
                                <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenHelpers ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Support')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.support')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExtrurder.support)}
                                    </Dropdown>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
}
VisualizerLeftBar.propTypes = {
    supportActions: PropTypes.object,
    autoRotateSelectedModel: PropTypes.func.isRequired,
    setTransformMode: PropTypes.func.isRequired,
    updateBoundingBox: PropTypes.func.isRequired
};

export default React.memo(VisualizerLeftBar);
