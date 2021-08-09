import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
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

class VisualizerLeftBar extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        selectedModelArray: PropTypes.array,
        // hasModel: PropTypes.bool,
        // gcodeLine: PropTypes.object,
        transformMode: PropTypes.string.isRequired,
        transformation: PropTypes.shape({
            positionX: PropTypes.number,
            positionY: PropTypes.number,
            rotationX: PropTypes.number,
            rotationY: PropTypes.number,
            rotationZ: PropTypes.number,
            uniformScalingState: PropTypes.bool,
            scaleX: PropTypes.number,
            scaleY: PropTypes.number,
            scaleZ: PropTypes.number
        }).isRequired,
        supportActions: PropTypes.object,
        defaultSupportSize: PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number
        }),
        inProgress: PropTypes.bool.isRequired,
        isSupporting: PropTypes.bool.isRequired,
        isSupportSelected: PropTypes.bool.isRequired,
        modelSize: PropTypes.object.isRequired,
        updateBoundingBox: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        setTransformMode: PropTypes.func.isRequired,
        uploadModel: PropTypes.func.isRequired,
        arrangeAllModels: PropTypes.func.isRequired,
        scaleToFitSelectedModel: PropTypes.func.isRequired,
        autoRotateSelectedModel: PropTypes.func.isRequired
    };

    state = {}

    fileInput = React.createRef();

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.props.uploadModel(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload model'),
                    body: e.message
                });
            }
        },
        changeUniformScalingState: (uniformScalingState) => {
            const transformation = {};
            transformation.uniformScalingState = !uniformScalingState;
            this.props.updateSelectedModelTransformation(transformation);
            this.actions.onModelAfterTransform();
        },
        onModelTransform: (transformations) => {
            const { size } = this.props;
            const transformation = {};
            for (const type of Object.keys(transformations)) {
                let value = transformations[type];
                switch (type) {
                    case 'moveX':
                        value = Math.min(Math.max(value, -size.x / 2), size.x / 2);
                        transformation.positionX = value;
                        break;
                    case 'moveY':
                        value = Math.min(Math.max(value, -size.y / 2), size.y / 2);
                        transformation.positionY = value;
                        break;
                    case 'scaleX':
                        transformation.scaleX = (this.props.transformation.scaleX > 0 ? value : -value);
                        break;
                    case 'scaleY':
                        transformation.scaleY = (this.props.transformation.scaleY > 0 ? value : -value);
                        break;
                    case 'scaleZ':
                        transformation.scaleZ = (this.props.transformation.scaleZ > 0 ? value : -value);
                        break;
                    case 'rotateX':
                        transformation.rotationX = value;
                        break;
                    case 'rotateY':
                        transformation.rotationY = value;
                        break;
                    case 'rotateZ':
                        transformation.rotationZ = value;
                        break;
                    case 'uniformScalingState':
                        transformation.uniformScalingState = value;
                        break;
                    default:
                        break;
                }
            }

            this.props.updateSelectedModelTransformation(transformation);
        },
        resetPosition: () => {
            this.actions.onModelTransform({
                'moveX': 0,
                'moveY': 0
            });
            this.actions.onModelAfterTransform();
        },
        resetScale: () => {
            this.actions.onModelTransform({
                'scaleX': 1,
                'scaleY': 1,
                'scaleZ': 1,
                'uniformScalingState': true
            });
            this.actions.onModelAfterTransform();
        },
        resetRotation: () => {
            this.actions.onModelTransform({
                'rotateX': 0,
                'rotateY': 0,
                'rotateZ': 0
            });
            this.actions.onModelAfterTransform();
        },
        mirrorSelectedModel: (value) => {
            switch (value) {
                case 'X':
                    this.props.updateSelectedModelTransformation({
                        scaleX: this.props.transformation.scaleX * -1
                    }, false);
                    break;
                case 'Y':
                    this.props.updateSelectedModelTransformation({
                        scaleY: this.props.transformation.scaleY * -1
                    }, false);
                    break;
                case 'Z':
                    this.props.updateSelectedModelTransformation({
                        scaleZ: this.props.transformation.scaleZ * -1
                    }, false);
                    break;
                case 'Reset':
                    this.props.updateSelectedModelTransformation({
                        scaleX: Math.abs(this.props.transformation.scaleX),
                        scaleY: Math.abs(this.props.transformation.scaleY),
                        scaleZ: Math.abs(this.props.transformation.scaleZ)
                    }, false);
                    break;
                default:
                    break;
            }
        },
        arrangeAllModels: () => {
            this.props.arrangeAllModels();
        },
        onModelAfterTransform: () => {
            this.props.onModelAfterTransform();
            this.props.updateBoundingBox();
        },
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
        },
        importFile: (fileObj) => {
            if (fileObj) {
                this.actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                this.actions.onClickToUpload();
            }
        }
    };

    componentDidMount() {
        UniApi.Event.on('appbar-menu:printing.import', this.actions.importFile);
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:printing.import', this.actions.importFile);
    }

    render() {
        const actions = this.actions;
        const { size, selectedModelArray, transformMode,
            transformation, defaultSupportSize, isSupporting,
            isSupportSelected, modelSize, supportActions, inProgress } = this.props;
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
        const transformDisabled = inProgress || !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
            return model.visible === true;
        }));
        const supportDisabled = inProgress || !(selectedModelArray.length === 1 && selectedModelArray.every((model) => {
            return model.visible === true && !model.supportTag;
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

        return (
            <React.Fragment>

                <div className={styles['visualizer-left-bar']}>
                    <input
                        ref={this.fileInput}
                        type="file"
                        accept=".stl, .obj"
                        style={{ display: 'none' }}
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
                                        onClick={() => {
                                            actions.onClickToUpload();
                                        }}
                                        size={48}
                                        disabled={inProgress}
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
                                            // Todo: Add selected props
                                            type={['hoverSpecial', 'pressSpecial']}
                                            name="ToolbarMove"
                                            size={48}
                                            onClick={() => {
                                                actions.setTransformMode('translate');
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
                                            type={['hoverSpecial', 'pressSpecial']}
                                            name="ToolbarScale"
                                            size={48}
                                            onClick={() => {
                                                actions.setTransformMode('scale');
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
                                            type={['hoverSpecial', 'pressSpecial']}
                                            name="ToolbarRotate"
                                            size={48}
                                            onClick={() => {
                                                actions.setTransformMode('rotate');
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
                                            type={['hoverSpecial', 'pressSpecial']}
                                            name="ToolbarMirror"
                                            size={48}
                                            onClick={() => {
                                                actions.setTransformMode('mirror');
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
                                            type={['hoverSpecial', 'pressSpecial']}
                                            name="ToolbarSupport"
                                            size={48}
                                            onClick={() => {
                                                actions.setTransformMode('support');
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
                                marginTop: '72px'
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
                                marginTop: '124px'
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
                                        onClick={this.props.scaleToFitSelectedModel}
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
                        <div className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
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
                                        onClick={this.props.autoRotateSelectedModel}
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

                    {!transformDisabled && transformMode === 'rotate' && (
                        <div
                            className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                            style={{
                                marginTop: '176px'
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
                                        onClick={this.props.autoRotateSelectedModel}
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
                            </div>
                        </div>
                    )}

                    {!transformDisabled && transformMode === 'mirror' && (
                        <div
                            className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
                            style={{
                                marginTop: '228px'
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
                                marginTop: '332px'
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
                                            min={1}
                                            max={size.x / 2}
                                            value={defaultSupportSize?.x}
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
                                            size="small"
                                            min={1}
                                            max={size.y / 2}
                                            value={defaultSupportSize?.y}
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
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const printing = state.printing;
    const {
        modelGroup,
        hasModel,
        gcodeLine,
        transformMode
    } = printing;
    let modelSize = {};
    const isSupportSelected = modelGroup.selectedModelArray.length === 1 && modelGroup.selectedModelArray.every((model) => {
        return model.supportTag;
    });
    if (isSupportSelected) {
        const model = modelGroup.selectedModelArray[0];
        const { min, max } = model.boundingBox;
        modelSize = {
            x: Number((max.x - min.x).toFixed(1)),
            y: Number((max.y - min.y).toFixed(1)),
            z: Number((max.z - min.z).toFixed(1))
        };
    }
    return {
        size: machine.size,
        selectedModelArray: modelGroup.selectedModelArray,
        transformation: modelGroup.getSelectedModelTransformationForPrinting(),
        defaultSupportSize: modelGroup.defaultSupportSize,
        hasModel,
        gcodeLine,
        isSupportSelected,
        modelSize,
        transformMode
    };
};

const mapDispatchToProps = (dispatch) => ({
    uploadModel: (file) => dispatch(printingActions.uploadModel(file)),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation, newUniformScalingState) => dispatch(printingActions.updateSelectedModelTransformation(transformation, newUniformScalingState))
    // setDefaultSupportSize: (size) => dispatch(printingActions.setDefaultSupportSize(size)),
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerLeftBar);
