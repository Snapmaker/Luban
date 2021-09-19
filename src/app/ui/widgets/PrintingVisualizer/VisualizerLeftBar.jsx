import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
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
import RotationAnalysisOverlay from './Overlay/RotationAnalysisOverlay';

function VisualizerLeftBar({ defaultSupportSize, setTransformMode, isSupporting, supportActions, updateBoundingBox, autoRotateSelectedModel }) {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup?.isSupportSelected());
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const [showRotationAnalyzeModal, setShowRotationAnalyzeModal] = useState(false);
    const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxWHD(), shallowEqual);
    let modelSize = {};
    if (isSupportSelected) {
        const model = selectedModelArray[0];
        const { min, max } = model.boundingBox;
        modelSize = {
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
                    title: i18n._('Failed to upload model.'),
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
    const transformDisabled = showRotationAnalyzeModal || !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));
    const supportDisabled = showRotationAnalyzeModal || !(selectedModelArray.length === 1 && selectedModelArray.every((model) => {
        return model.visible === true && !model.supportTag;
    }));
    const rotationAnalysisEnable = (selectedModelArray.length === 1 && selectedModelArray.every((model) => {
        return model.visible === true;
    }));

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
        return () => {
            UniApi.Event.off('appbar-menu:printing.import', actions.importFile);
        };
    }, []);

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
                            {i18n._('Move')}
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
                                        <span>{i18n._('Reset')}</span>
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
                            {i18n._('Scale')}
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
                                    {i18n._('Uniform Scaling')}
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
                                    <span>{i18n._('Scale to Fit')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetScale}
                                >
                                    <span>{i18n._('Reset')}</span>
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
                            {i18n._('Scale')}
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
                                            actions.onModelTransform({ 'scaleX': value / modelSize.x });
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
                                            actions.onModelTransform({ 'scaleY': value / modelSize.y });
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
                                            actions.onModelTransform({ 'scaleZ': value / modelSize.z });
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
                                    onClick={autoRotateSelectedModel}
                                >
                                    <span>{i18n._('Auto Rotate')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetRotation}
                                >
                                    <span>{i18n._('Reset')}</span>
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
                            {i18n._('Rotate')}
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
                                    onClick={autoRotateSelectedModel}
                                >
                                    <span>{i18n._('Auto Rotate')}</span>
                                </Button>
                                <Button
                                    className="margin-top-32 margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={actions.resetRotation}
                                >
                                    <span>{i18n._('Reset')}</span>
                                </Button>
                            </div>
                            <div className="sm-flex">
                                <Button
                                    className="margin-top-16"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    disabled={!rotationAnalysisEnable}
                                    onClick={() => {
                                        dispatch(printingActions.startAnalyzeRotationProgress());
                                        setTimeout(() => {
                                            setShowRotationAnalyzeModal(true);
                                        }, 100);
                                    }}
                                >
                                    <span>{i18n._('Rotation Analyze')}</span>
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
                            {i18n._('Mirror')}
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
                                    <span className="color-red-1">{i18n._('X ')}</span>
                                    <span>{i18n._('axis')}</span>
                                </Button>
                                <Button
                                    className="margin-horizontal-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={() => actions.mirrorSelectedModel('Y')}
                                >
                                    <span className="color-green-1">{i18n._('Y ')}</span>
                                    <span>{i18n._('axis')}</span>
                                </Button>
                                <Button
                                    className="margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={() => actions.mirrorSelectedModel('Z')}
                                >
                                    <span className="color-blue-2">{i18n._('Z ')}</span>
                                    <span>{i18n._('axis')}</span>
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
                            {i18n._('Manual Support')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex">{i18n._('Support Size')}</div>
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
                                    <span>{i18n._('Add Support')}</span>
                                </Button>
                                <Button
                                    className="margin-left-8"
                                    type="primary"
                                    priority="level-three"
                                    width="100%"
                                    onClick={supportActions.stopSupportMode}
                                >
                                    <span>{i18n._('Done')}</span>
                                </Button>
                            </div>
                            <Button
                                className="margin-top-16"
                                type="primary"
                                priority="level-three"
                                width="100%"
                                onClick={supportActions.clearAllManualSupport}
                            >
                                <span>{i18n._('Clear All Support')}</span>
                            </Button>
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
