import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import i18n from '../../../lib/i18n';
import { toFixed } from '../../../lib/numeric-utils';
import UniApi from '../../../lib/uni-api';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import modal from '../../../lib/modal';

class VisualizerLeftBar extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        selectedModelArray: PropTypes.array,
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
        }).isRequired,
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
        const { size, selectedModelArray, transformMode, transformation, defaultSupportSize, isSupporting, isSupportSelected, modelSize, supportActions, inProgress } = this.props;
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
        const rotateDisabled = inProgress || (selectedModelArray.length > 0 && selectedModelArray.some((model) => {
            return model.supportTag;
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
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".stl, .obj"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div className={styles.leftbar} id="sidebar">
                    <nav className={styles.navbar}>
                        <ul className={styles.nav}>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['operation-add'],
                                        { [styles.disabled]: inProgress }
                                    )}
                                    onClick={() => {
                                        actions.onClickToUpload();
                                    }}
                                    disabled={inProgress}
                                />
                            </li>
                        </ul>
                        <ul className={styles.nav}>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['operation-move'],
                                        { [styles.disabled]: (transformDisabled) },
                                        {
                                            [styles.selected]: !transformDisabled && transformMode === 'translate'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.setTransformMode('translate');
                                    }}
                                    disabled={transformDisabled}
                                />
                            </li>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['operation-scale'],
                                        { [styles.disabled]: (transformDisabled) },
                                        {
                                            [styles.selected]: !transformDisabled && transformMode === 'scale'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.setTransformMode('scale');
                                    }}
                                    disabled={transformDisabled}
                                />
                            </li>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['operation-rotate'],
                                        { [styles.disabled]: transformDisabled || rotateDisabled },
                                        {
                                            [styles.selected]: !(transformDisabled || rotateDisabled) && transformMode === 'rotate'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.setTransformMode('rotate');
                                    }}
                                    disabled={transformDisabled || rotateDisabled}
                                />
                            </li>
                        </ul>
                        <ul className={styles.nav}>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['model-operation'],
                                        styles['operation-mirror'],
                                        { [styles.disabled]: transformDisabled },
                                        {
                                            [styles.selected]: !transformDisabled && transformMode === 'mirror'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.setTransformMode('mirror');
                                    }}
                                    disabled={transformDisabled}
                                />
                            </li>
                        </ul>
                        <ul className={styles.nav}>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['operation-arrange'],
                                        { [styles.disabled]: inProgress },
                                        {
                                            [styles.selected]: !transformDisabled && transformMode === 'arrange'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.arrangeAllModels();
                                    }}
                                    disabled={inProgress}
                                />
                            </li>
                        </ul>
                        <ul className={styles.nav}>
                            <li
                                className={classNames(
                                    'text-center'
                                )}
                            >
                                <Anchor
                                    componentClass="button"
                                    className={classNames(
                                        styles['model-operation'],
                                        styles['operation-support'],
                                        { [styles.disabled]: supportDisabled },
                                        {
                                            [styles.selected]: !supportDisabled && transformMode === 'support'
                                        }
                                    )}
                                    onClick={() => {
                                        actions.setTransformMode('support');
                                    }}
                                    disabled={supportDisabled}
                                />
                            </li>
                        </ul>
                    </nav>
                </div>
                {!transformDisabled && transformMode === 'translate' && (
                    <div className={classNames(styles.panel, styles['move-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    value={moveX}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'moveX': value });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-1']}>mm</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    value={moveY}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'moveY': value });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-1']}>mm</span>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                onClick={actions.resetPosition}
                            >
                                <span>{i18n._('Reset')}</span>
                            </Anchor>
                        </div>
                    </div>
                )}
                {!transformDisabled && !isSupportSelected && transformMode === 'scale' && (
                    <div className={classNames(styles.panel, styles['scale-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={scaleXPercent}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleX': value / 100 });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>%</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={scaleYPercent}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleY': value / 100 });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>%</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-blue'])}>Z</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={scaleZPercent}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleZ': value / 100 });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>%</span>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                onClick={() => {
                                    actions.changeUniformScalingState(uniformScalingState);
                                }}
                            >
                                <i className={classNames(styles.icon, uniformScalingState ? styles['icon-checked'] : styles['icon-unchecked'])} />
                                <span>{i18n._('Uniform Scaling')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                onClick={this.props.scaleToFitSelectedModel}
                            >
                                <span>{i18n._('Scale to Fit')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                onClick={actions.resetScale}
                            >
                                <span>{i18n._('Reset')}</span>
                            </Anchor>
                        </div>
                    </div>
                )}

                {!transformDisabled && isSupportSelected && transformMode === 'scale' && (
                    <div className={classNames(styles.panel, styles['scale-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={modelSize.x}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleX': value / modelSize.x });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>mm</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={modelSize.y}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleY': value / modelSize.y });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>mm</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-blue'])}>Z</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={1}
                                    value={modelSize.z}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'scaleZ': value / modelSize.z });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>mm</span>
                        </div>
                    </div>
                )}

                {!transformDisabled && transformMode === 'rotate' && (
                    <div className={classNames(styles.panel, styles['rotate-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateX}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateX': THREE.Math.degToRad(degree) });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateY}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateY': THREE.Math.degToRad(degree) });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-blue'])}>Z</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateZ}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateZ': THREE.Math.degToRad(degree) });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                onClick={this.props.autoRotateSelectedModel}
                            >
                                <span>{i18n._('Auto Rotate')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.axis}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                onClick={actions.resetRotation}
                            >
                                <span>{i18n._('Reset')}</span>
                            </Anchor>
                        </div>
                    </div>
                )}

                {!transformDisabled && transformMode === 'mirror' && (
                    <div className={classNames(styles.panel, styles['mirror-panel'])}>
                        <div className={classNames(styles.axis, styles['axis-padding-left'])}>
                            <span className={classNames(styles['title-mode'])}>{i18n._('Mirror')}</span>
                        </div>
                        <div className={classNames(styles.axis, styles['axis-padding-left'])}>
                            <Anchor
                                componentClass="button"
                                style={{ width: '60px' }}
                                className={styles['reset-button']}
                                onClick={() => actions.mirrorSelectedModel('X')}
                            >
                                <span>{i18n._('X-axis')}</span>
                            </Anchor>
                            <Anchor
                                componentClass="button"
                                style={{ width: '60px' }}
                                className={styles['reset-button']}
                                onClick={() => actions.mirrorSelectedModel('Y')}
                            >
                                <span>{i18n._('Y-axis')}</span>
                            </Anchor>
                            <Anchor
                                componentClass="button"
                                style={{ width: '60px' }}
                                className={styles['reset-button']}
                                onClick={() => actions.mirrorSelectedModel('Z')}
                            >
                                <span>{i18n._('Z-axis')}</span>
                            </Anchor>
                        </div>
                        {/*TODO: Cannot easily reset because different method to calculate scales*/}
                        {/*<div className={classNames(styles.axis, styles['axis-padding-left'])}>*/}
                        {/*    <Anchor*/}
                        {/*        componentClass="button"*/}
                        {/*        style={{ width: '198px' }}*/}
                        {/*        className={styles['reset-button']}*/}
                        {/*        onClick={() => actions.mirrorSelectedModel('Reset')}*/}
                        {/*    >*/}
                        {/*        <span>{i18n._('Reset')}</span>*/}
                        {/*    </Anchor>*/}
                        {/*</div>*/}
                    </div>
                )}

                {!supportDisabled && transformMode === 'support' && (
                    <div className={classNames(styles.panel, styles['support-panel'])}>
                        <div className={classNames(styles.axis, styles['axis-padding-left'])}>
                            <span className={classNames(styles['title-mode'])}>{i18n._('Manual Support')}</span>
                        </div>
                        <div className={classNames(styles.axis, styles['axis-padding-left'])}>

                            <span style={{ fontSize: '14px', width: '125px', display: 'inline-block' }}>
                                {i18n._('Support Size(mm)')}
                            </span>

                            <span
                                className={classNames(styles['input-container'])}

                            >
                                <Input
                                    min={1}
                                    max={size.y / 2}
                                    value={defaultSupportSize.x}
                                    onChange={(value) => {
                                        supportActions.setDefaultSupportSize({ x: value });
                                    }}
                                />
                                <span className={classNames(styles.suffix)}>X</span>
                            </span>
                            <span
                                className={classNames(styles['input-container'])}

                            >
                                <Input
                                    min={1}
                                    max={size.y / 2}
                                    value={defaultSupportSize.y}
                                    onChange={(value) => {
                                        supportActions.setDefaultSupportSize({ y: value });
                                    }}
                                />
                                <span className={classNames(styles.suffix)}>Y</span>
                            </span>

                        </div>
                        <div className={classNames(styles.axis)}>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                style={{ width: '125px' }}
                                disabled={isSupporting}
                                onClick={supportActions.startSupportMode}
                            >
                                <span>{i18n._('Add Support')}</span>
                            </Anchor>
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                style={{ width: '128px' }}
                                onClick={supportActions.stopSupportMode}
                            >
                                <span>{i18n._('Done')}</span>
                            </Anchor>

                        </div>
                        <div
                            className={classNames(styles.axis)}
                            style={{ borderTop: '1px solid #E7E8E9', paddingTop: '10px' }}
                        >
                            <Anchor
                                componentClass="button"
                                className={styles['reset-button']}
                                style={{ width: '125px' }}
                                onClick={supportActions.clearAllManualSupport}
                            >
                                <span>{i18n._('Clear All Support')}</span>
                            </Anchor>
                        </div>

                    </div>
                )}

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
        // defaultSupportSize: modelGroup.defaultSupportSize,
        hasModel,
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
