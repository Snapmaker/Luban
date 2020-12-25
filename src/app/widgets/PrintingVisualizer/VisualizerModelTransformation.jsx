import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as printingActions } from '../../flux/printing';


class VisualizerModelTransformation extends PureComponent {
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
        isSupporting: PropTypes.bool.isRequired,
        isSupportSelected: PropTypes.bool.isRequired,
        modelSize: PropTypes.object.isRequired,
        // transformation: PropTypes.object,
        // getControls: PropTypes.func.isRequired,
        // clearAllManualSupport: PropTypes.func.isRequired,
        updateBoundingBox: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        // setDefaultSupportSize: PropTypes.func.isRequired,
        setTransformMode: PropTypes.func.isRequired
    };

    state = {}

    actions = {
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
                        transformation.scaleX = value;
                        break;
                    case 'scaleY':
                        transformation.scaleY = value;
                        break;
                    case 'scaleZ':
                        transformation.scaleZ = value;
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
        onModelAfterTransform: () => {
            this.props.onModelAfterTransform();
            this.props.updateBoundingBox();
        },
        // setDefaultSupportSize: (size) => {
        //     // size = { ...this.props.defaultSupportSize, ...size };
        //     this.props.supportActions.setDefaultSize(size);
        // },
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
        }
        // startSupportMode: () => {
        //     this.props.getControls().startSupportMode();
        // },
        // stopSupportMode: () => {
        //     // this.props.getControls().stopSupportMode();
        // },
        // clearAllManualSupport: () => {
        //     this.props.clearAllManualSupport();
        // }


    };

    render() {
        const actions = this.actions;
        const { size, selectedModelArray, transformMode, transformation, defaultSupportSize, isSupporting, isSupportSelected, modelSize, supportActions } = this.props;
        let moveX = 0;
        let moveY = 0;
        let scaleXPercent = 100;
        let scaleYPercent = 100;
        let scaleZPercent = 100;
        let rotateX = 0;
        let rotateY = 0;
        let rotateZ = 0;
        let uniformScalingState = true;
        const transformDisabled = !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
            return model.visible === true;
        }));
        const supportDisabled = !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
            return model.visible === true && !model.supportTag;
        }));


        if (selectedModelArray.length >= 1) {
            moveX = Number(toFixed(transformation.positionX, 1));
            moveY = Number(toFixed(transformation.positionY, 1));
            rotateX = Number(toFixed(THREE.Math.radToDeg(transformation.rotationX), 1));
            rotateY = Number(toFixed(THREE.Math.radToDeg(transformation.rotationY), 1));
            rotateZ = Number(toFixed(THREE.Math.radToDeg(transformation.rotationZ), 1));
            scaleXPercent = Number(toFixed((transformation.scaleX * 100), 1));
            scaleYPercent = Number(toFixed((transformation.scaleY * 100), 1));
            scaleZPercent = Number(toFixed((transformation.scaleZ * 100), 1));
            uniformScalingState = transformation.uniformScalingState;
        }

        return (
            <React.Fragment>
                <div className={classNames(styles['model-transformation__container'])}>
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-move'],
                            { [styles.disabled]: transformDisabled },
                            {
                                [styles.selected]: !transformDisabled && transformMode === 'translate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('translate');
                        }}
                        disabled={transformDisabled}
                    />
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
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
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-rotate'],
                            { [styles.disabled]: transformDisabled || supportDisabled },
                            {
                                [styles.selected]: !(transformDisabled || supportDisabled) && transformMode === 'rotate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('rotate');
                        }}
                        disabled={transformDisabled || supportDisabled}
                    />
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
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#e83100'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={moveX}
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    step={0.1}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'moveX': value });
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
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
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#22ac38'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={moveY}
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    step={0.1}
                                    onChange={(value) => {
                                        actions.onModelTransform({ 'moveY': value });
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}


                                />
                            </span>
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
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#e83100'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateX}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateX': THREE.Math.degToRad(degree) });
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}


                                />
                            </span>
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
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#22ac38'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateY}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateY': THREE.Math.degToRad(degree) });
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}


                                />
                            </span>
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
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#00b7ee'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateZ}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform({ 'rotateZ': THREE.Math.degToRad(degree) });
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}


                                />
                            </span>
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
                                    min={0}
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
                                    min={0}
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
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation) => dispatch(printingActions.updateSelectedModelTransformation(transformation))
    // setDefaultSupportSize: (size) => dispatch(printingActions.setDefaultSupportSize(size)),
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerModelTransformation);
