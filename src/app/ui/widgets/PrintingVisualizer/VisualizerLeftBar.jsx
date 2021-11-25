import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import { cloneDeep } from 'lodash';
import i18n from '../../../lib/i18n';
import { toFixed } from '../../../lib/numeric-utils';
import UniApi from '../../../lib/uni-api';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import modal from '../../../lib/modal';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Checkbox from '../../components/Checkbox';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import RotationAnalysisOverlay from './Overlay/RotationAnalysisOverlay';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, EPSILON } from '../../../constants';
import { machineStore } from '../../../store/local-storage';

const extruderLabelMap = {
    '0': 'Extruder L',
    '1': 'Extruder R',
    '2': 'Extruder Both'
};
const originalModelsExtruder = {
    multiple: '0',
    infill: '0',
    shell: '0'
};
const originalHelpersExtruder = {
    multiple: '1',
    support: '1',
    adhesion: '1'
};
function VisualizerLeftBar({ defaultSupportSize, setTransformMode, isSupporting, supportActions, updateBoundingBox, autoRotateSelectedModel }) {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const selectedGroup = useSelector(state => state?.printing?.modelGroup?.selectedGroup, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const helpersExtruderConfig = useSelector(state => state?.printing?.helpersExtruderConfig);
    console.log({ selectedModelArray, helpersExtruderConfig });
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup?.isSupportSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);
    const [modelsExtruder, setModelsExtruder] = useState(originalModelsExtruder);
    const [helpersExturder, setHelpersExtruder] = useState(helpersExtruderConfig || originalHelpersExtruder);
    const [isOpenModels, setIsOpenModels] = useState(false);
    const [isOpenHelpers, setIsOpenHelpers] = useState(false);
    const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxWHD(), shallowEqual);
    const colorL = '#FF8B00';
    const colorR = '#0053AA';
    let modelSize = {};
    if (isSupportSelected) {
        const model = selectedModelArray[0];
        const { min, max } = model.boundingBox;
        modelSize = {
            scaledX: (max.x - min.x) / selectedGroup.scale.x,
            scaledY: (max.y - min.y) / selectedGroup.scale.y,
            scaledZ: (max.z - min.z) / selectedGroup.scale.z,
            x: Number((max.x - min.x).toFixed(1)),
            y: Number((max.y - min.y).toFixed(1)),
            z: Number((max.z - min.z).toFixed(1))
        };
    }
    const dispatch = useDispatch();
    const fileInput = useRef(null);

    const renderRotationAnalyzeModal = () => {
        return (
            <RotationAnalysisOverlay onClose={() => { setShowRotationAnalyzeModal(false); }} />
        );
    };

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
        changeUniformScalingState: (uniformScalingState) => {
            const newTransformation = {};
            newTransformation.uniformScalingState = !uniformScalingState;
            dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
            actions.onModelAfterTransform();
        },
        onModelTransform: (transformations, isReset) => {
            const newTransformation = {};
            for (const type of Object.keys(transformations)) {
                let value = transformations[type];
                switch (type) {
                    case 'moveX':
                        value = Math.min(Math.max(value, -size.x / 2), size.x / 2);
                        newTransformation.positionX = value;
                        break;
                    case 'moveY':
                        value = Math.min(Math.max(value, -size.y / 2), size.y / 2);
                        newTransformation.positionY = value;
                        break;
                    case 'scaleX':
                        newTransformation.scaleX = (transformation.scaleX > 0 ? value : -value);
                        break;
                    case 'scaleY':
                        newTransformation.scaleY = (transformation.scaleY > 0 ? value : -value);
                        break;
                    case 'scaleZ':
                        newTransformation.scaleZ = (transformation.scaleZ > 0 ? value : -value);
                        break;
                    case 'rotateX':
                        newTransformation.rotationX = value;
                        break;
                    case 'rotateY':
                        newTransformation.rotationY = value;
                        break;
                    case 'rotateZ':
                        newTransformation.rotationZ = value;
                        break;
                    case 'uniformScalingState':
                        newTransformation.uniformScalingState = value;
                        break;
                    default:
                        break;
                }
            }
            if (isReset) {
                dispatch(printingActions.updateSelectedModelTransformation(newTransformation, false));
            } else {
                dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
            }
        },
        resetPosition: () => {
            actions.onModelTransform({
                'moveX': 0,
                'moveY': 0
            });
            actions.onModelAfterTransform();
        },
        resetScale: () => {
            actions.onModelTransform({
                'scaleX': 1,
                'scaleY': 1,
                'scaleZ': 1,
                'uniformScalingState': true
            }, true);
            actions.onModelAfterTransform();
        },
        resetRotation: () => {
            actions.onModelTransform({
                'rotateX': 0,
                'rotateY': 0,
                'rotateZ': 0
            });
            actions.onModelAfterTransform();
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
        scaleToFitSelectedModel: () => {
            const scalar = ['x', 'y', 'z'].reduce((prev, key) => Math.min((size[key] - 5) / selectedModelBBoxDes[key], prev), Number.POSITIVE_INFINITY);
            const newTransformation = {
                scaleX: scalar * transformation.scaleX,
                scaleY: scalar * transformation.scaleY,
                scaleZ: scalar * transformation.scaleZ,
                positionX: 0,
                positionY: 0
            };
            dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
            actions.onModelAfterTransform();
        },
        rotateWithAnalysis: () => {
            actions.rotateOnlyForUniformScale(() => {
                dispatch(printingActions.startAnalyzeRotationProgress());
                setTimeout(() => {
                    setShowRotationAnalyzeModal(true);
                }, 100);
            });
        },
        autoRotate: () => {
            actions.rotateOnlyForUniformScale(() => {
                autoRotateSelectedModel();
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
                        const newHelpersExtruder = cloneDeep(helpersExturder);
                        Object.keys(newHelpersExtruder).forEach(key => {
                            newHelpersExtruder[key] = direction;
                        });
                        setHelpersExtruder(newHelpersExtruder);
                    }
                    break;
                case 'infill':
                    setModelsExtruder({
                        ...modelsExtruder,
                        infill: direction,
                        multiple: modelsExtruder.shell === direction ? direction : '2'
                    });
                    dispatch(printingActions.updateSelectedModelsExtruder({ infill: direction, shell: modelsExtruder.shell }));
                    break;
                case 'shell':
                    setModelsExtruder({
                        ...modelsExtruder,
                        shell: direction,
                        multiple: modelsExtruder.infill === direction ? direction : '2'
                    });
                    dispatch(printingActions.updateSelectedModelsExtruder({ shell: direction, infill: modelsExtruder.infill }));
                    break;
                case 'adhesion':
                    setHelpersExtruder({
                        ...helpersExturder,
                        adhesion: direction,
                        multiple: helpersExturder.support === direction ? direction : '2'
                    });
                    dispatch(printingActions.updateHelpersExtruder({ support: helpersExturder.support, adhesion: direction }));
                    break;
                case 'support':
                    setHelpersExtruder({
                        ...helpersExturder,
                        support: direction,
                        multiple: helpersExturder.adhesion === direction ? direction : '2'
                    });
                    dispatch(printingActions.updateHelpersExtruder({ adhesion: helpersExturder.adhesion, support: direction }));
                    break;
                default:
                    break;
            }
            console.log({ type, typeArr, direction });
        },
        handleOpen: (type) => {
            switch (type) {
                case 'models':
                    setIsOpenModels(!isOpenModels);
                    break;
                case 'helpers':
                    setIsOpenHelpers(!isOpenHelpers);
                    break;
                default:
                    break;
            }
        }
    };
    const extruderOverlay = (type) => (
        <Menu>
            <Menu.Item
                onClick={() => actions.onChangeExtruder(type, '0')}
                key="L"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder L')}</span>
                    <SvgIcon
                        name="Extruder"
                        size={24}
                        color={colorL}
                        type={['static']}
                    />
                </div>
            </Menu.Item>
            <Menu.Item
                onClick={() => actions.onChangeExtruder(type, '1')}
                key="R"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder R')}</span>
                    <SvgIcon
                        name="Extruder"
                        size={24}
                        color={colorR}
                        type={['static']}
                    />
                </div>
            </Menu.Item>
        </Menu>
    );
    const renderExtruderStatus = (status) => (
        // <div>{i18n._(`key-Printing/LeftBar-${extruderLabelMap[status]}`)}</div>
        <div className="sm-flex justify-space-between margin-left-16 width-160 border-default-black-5 border-radius-8 padding-vertical-4 padding-left-8">
            <span>{extruderLabelMap[status]}</span>
            {console.log({ status })}
            <div className="sm-flex">
                <div className="position-re width-24">
                    <SvgIcon
                        color={status === '1' ? colorR : colorL}
                        size={24}
                        name="ExtruderLeft"
                        type={['static']}
                        className="position-ab"
                    />
                    <SvgIcon
                        color={status === '0' ? colorL : colorR}
                        size={24}
                        name="ExtruderRight"
                        type={['static']}
                        className="position-ab right-1"
                    />
                </div>
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
    const transformDisabled = showRotationAnalyzeModal || !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));
    const supportDisabled = showRotationAnalyzeModal || !(selectedModelArray.length === 1 && selectedModelArray.every((model) => {
        return model.visible === true && !model.supportTag;
    }));
    const rotationAnalysisEnable = (selectedModelArray.length === 1 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));
    const isDualExtruder = machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;

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

    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.import', actions.importFile);
        let newHelpersExtruder = cloneDeep(helpersExturder);
        newHelpersExtruder = {
            ...newHelpersExtruder,
            multiple: newHelpersExtruder.support === newHelpersExtruder.adhesion ? newHelpersExtruder.support : '2'
        };
        setHelpersExtruder(newHelpersExtruder);
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        console.log({ selectedModelArray });
        let tempInfillExtruder = '';
        let tempShellExtruder = '';
        if (selectedModelArray.length > 0) {
            let extruderConfig = selectedModelArray[0].extruderConfig;
            tempInfillExtruder = extruderConfig.infill;
            tempShellExtruder = extruderConfig.shell;
            if (selectedModelArray.length > 1) {
                for (const item of selectedModelArray.slice(1)) {
                    extruderConfig = item.extruderConfig;
                    if (extruderConfig.infill !== tempInfillExtruder && tempInfillExtruder !== '2') {
                        tempInfillExtruder = '2';
                    }
                    if (extruderConfig.shell !== tempShellExtruder && tempShellExtruder !== '2') {
                        tempShellExtruder = '2';
                    }
                    if (tempShellExtruder === '2' && tempInfillExtruder === '2') {
                        break;
                    }
                }
            }
        }
        setModelsExtruder({
            multiple: tempInfillExtruder === tempShellExtruder ? tempInfillExtruder : '2',
            infill: tempInfillExtruder,
            shell: tempShellExtruder
        });
        console.log({ tempInfillExtruder, tempShellExtruder });
    }, [selectedModelArray]);

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
                                            { [styles.selected]: (!transformDisabled && transformMode === 'translate') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!transformDisabled && transformMode === 'translate' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                        name="ToolbarMove"
                                        size={48}
                                        onClick={() => {
                                            setTransformMode('translate');
                                        }}
                                        disabled={transformDisabled}
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
                                        disabled={transformDisabled}
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
                                        disabled={transformDisabled || isSupportSelected}
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
                                        disabled={transformDisabled || isSupportSelected}
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
                                            { [styles.selected]: (!transformDisabled && transformMode === 'support') },
                                            'padding-horizontal-4'
                                        )}
                                        type={[`${!transformDisabled && transformMode === 'support' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
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
                                                { [styles.selected]: (!transformDisabled && transformMode === 'extruder') },
                                                'padding-horizontal-4'
                                            )}
                                            type={[`${!transformDisabled && transformMode === 'extruder' ? 'hoverNoBackground' : 'hoverSpecial'}`, 'pressSpecial']}
                                            name="ToolbarExtruder"
                                            size={48}
                                            onClick={() => {
                                                setTransformMode('extruder');
                                            }}
                                            disabled={transformDisabled}
                                        />
                                    </li>
                                )}
                            </ul>
                        </span>
                    </nav>
                </div>
                {!transformDisabled && transformMode === 'translate' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '60px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Move')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-red-1">X</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="mm"
                                        size="small"
                                        min={-size.x / 2}
                                        max={size.x / 2}
                                        value={moveX}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'moveX': value });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-green-1">Y</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="mm"
                                        size="small"
                                        min={-size.y / 2}
                                        max={size.y / 2}
                                        value={moveY}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'moveY': value });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            {!isSupportSelected && (
                                <div className="sm-flex">
                                    <Button
                                        className="margin-top-32"
                                        type="primary"
                                        priority="level-three"
                                        width="100%"
                                        onClick={actions.resetPosition}
                                    >
                                        <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {!transformDisabled && !isSupportSelected && transformMode === 'scale' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '112px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Scale')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-red-1">X</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="%"
                                        size="small"
                                        min={1}
                                        value={scaleXPercent}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleX': value / 100 });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-green-1">Y</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="%"
                                        size="small"
                                        min={1}
                                        value={scaleYPercent}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleY': value / 100 });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="%"
                                        size="small"
                                        min={1}
                                        value={scaleZPercent}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleZ': value / 100 });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <Checkbox
                                    defaultChecked={uniformScalingState}
                                    checked={uniformScalingState}
                                    onClick={() => {
                                        actions.changeUniformScalingState(uniformScalingState); // Todo: bug, state error
                                    }}
                                />
                                <span
                                    className="height-20 margin-horizontal-8"
                                >
                                    {i18n._('key-Printing/LeftBar-Uniform Scaling')}
                                </span>
                            </div>
                            <div className="sm-flex">
                                <Button
                                    className="margin-top-32 margin-right-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.scaleToFitSelectedModel}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Scale to Fit')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetScale}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!transformDisabled && isSupportSelected && transformMode === 'scale' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '112px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Scale')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-red-1">X</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={1}
                                        value={modelSize.x}
                                        suffix="mm"
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleX': value / modelSize.scaledX });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-green-1">Y</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={1}
                                        value={modelSize.y}
                                        suffix="mm"
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleY': value / modelSize.scaledY });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={1}
                                        suffix="mm"
                                        value={modelSize.z}
                                        onChange={(value) => {
                                            actions.onModelTransform({ 'scaleZ': value / modelSize.scaledZ });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        {!isSupportSelected && (
                            <div className="sm-flex">
                                <Button
                                    className="margin-top-32 margin-right-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.autoRotate}
                                    disabled={selectedModelArray.length > 1}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Auto Rotate')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetRotation}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                {showRotationAnalyzeModal && renderRotationAnalyzeModal()}
                {!transformDisabled && transformMode === 'rotate' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '164px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Rotate')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-red-1">X</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={-180}
                                        max={180}
                                        value={rotateX}
                                        suffix="°"
                                        onChange={(degree) => {
                                            actions.onModelTransform({ 'rotateX': THREE.Math.degToRad(degree) });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-green-1">Y</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={-180}
                                        max={180}
                                        suffix="°"
                                        value={rotateY}
                                        onChange={(degree) => {
                                            actions.onModelTransform({ 'rotateY': THREE.Math.degToRad(degree) });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-bottom-8">
                                <span className="sm-flex-auto width-16 color-blue-2">Z</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        size="small"
                                        min={-180}
                                        max={180}
                                        suffix="°"
                                        value={rotateZ}
                                        onChange={(degree) => {
                                            actions.onModelTransform({ 'rotateZ': THREE.Math.degToRad(degree) });
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex">
                                <Button
                                    className="margin-top-32 margin-right-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.autoRotate}
                                    disabled={selectedModelArray.length > 1}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Auto Rotate')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetRotation}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Reset')}</span>
                                </Button>
                            </div>
                            <div className="sm-flex">
                                <Button
                                    className="margin-top-16"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    disabled={!rotationAnalysisEnable}
                                    onClick={actions.rotateWithAnalysis}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Rotate on Face')}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!transformDisabled && transformMode === 'mirror' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '216px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Mirror')}
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

                {!supportDisabled && transformMode === 'support' && (
                    <div
                        className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '268px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Manual Support')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex">{i18n._('key-Printing/LeftBar-Support Size')}</div>
                            <div className="sm-flex height-32 margin-bottom-8 margin-top-16">
                                <span className="sm-flex-auto width-16 color-red-1">X</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="mm"
                                        size="small"
                                        disabled={isSupporting}
                                        min={1}
                                        max={size.x / 2}
                                        value={defaultSupportSize.x}
                                        onChange={(value) => {
                                            supportActions.setDefaultSupportSize({ x: value });
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex height-32">
                                <span className="sm-flex-auto width-16 color-green-1">Y</span>
                                <div className="position-ab sm-flex-auto margin-horizontal-24">
                                    <Input
                                        suffix="mm"
                                        disabled={isSupporting}
                                        size="small"
                                        min={1}
                                        max={size.y / 2}
                                        value={defaultSupportSize.y}
                                        onChange={(value) => {
                                            supportActions.setDefaultSupportSize({ y: value });
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="sm-flex margin-top-32">
                                <Button
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    disabled={isSupporting}
                                    onClick={supportActions.startSupportMode}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Add Support')}</span>
                                </Button>
                                <Button
                                    className="margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={supportActions.stopSupportMode}
                                >
                                    <span>{i18n._('key-Printing/LeftBar-Done')}</span>
                                </Button>
                            </div>
                            <Button
                                className="margin-top-16"
                                type="primary"
                                priority="level-three"
                                width="100%"
                                onClick={supportActions.clearAllManualSupport}
                            >
                                <span>{i18n._('key-Printing/LeftBar-Clear All Support')}</span>
                            </Button>
                        </div>
                    </div>
                )}
                {!transformDisabled && transformMode === 'extruder' && isDualExtruder && (
                    <div
                        className="position-ab width-328 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                        style={{
                            marginTop: '320px'
                        }}
                    >
                        <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                            {i18n._('key-Printing/LeftBar-Extruder')}
                        </div>
                        <div className="padding-vertical-16 padding-right-16 padding-left-8">
                            <div className="select-models-container">
                                <div className="sm-flex align-center">
                                    <SvgIcon
                                        size={24}
                                        hoversize={24}
                                        name="DropdownOpen"
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
                            <div className="height-1 border-bottom-dashed-grey-1 margin-horizontal-16 margin-top-16 margin-bottom-8" />
                            <div className="select-models-container">
                                <div className="sm-flex align-center">
                                    <SvgIcon
                                        size={24}
                                        hoversize={24}
                                        name="DropdownOpen"
                                        color="#545659"
                                        onClick={() => actions.handleOpen('helpers')}
                                    />
                                    <div role="presentation" onClick={() => actions.handleOpen('helpers')} className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-All Helpers')}</div>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.multiple')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExturder.multiple)}
                                    </Dropdown>
                                </div>
                                <div className={`align-center margin-left-24 margin-top-8 ${isOpenHelpers ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Adhesion')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.adhesion')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExturder.adhesion)}
                                    </Dropdown>
                                </div>
                                <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenHelpers ? 'sm-flex' : 'display-none'}`}>
                                    <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Support')}</span>
                                    <Dropdown
                                        placement="bottomRight"
                                        overlay={() => extruderOverlay('helpers.support')}
                                        trigger="click"
                                    >
                                        {renderExtruderStatus(helpersExturder.support)}
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
    defaultSupportSize: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number
    }),
    supportActions: PropTypes.object,
    // scaleToFitSelectedModel: PropTypes.func.isRequired,
    autoRotateSelectedModel: PropTypes.func.isRequired,
    setTransformMode: PropTypes.func.isRequired,
    updateBoundingBox: PropTypes.func.isRequired,
    isSupporting: PropTypes.bool.isRequired

};

export default React.memo(VisualizerLeftBar);
