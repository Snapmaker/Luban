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
        // transformation: PropTypes.object,
        updateBoundingBox: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        setTransformMode: PropTypes.func.isRequired
    };


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
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
        }

    };

    render() {
        const actions = this.actions;
        const { size, selectedModelArray, transformMode, transformation } = this.props;
        let moveX = 0;
        let moveY = 0;
        let scaleXPercent = 100;
        let scaleYPercent = 100;
        let scaleZPercent = 100;
        let rotateX = 0;
        let rotateY = 0;
        let rotateZ = 0;
        let uniformScalingState = true;
        const disabled = !(selectedModelArray.length > 0 && selectedModelArray.every((model) => {
            return model.visible === true;
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
                <div className={classNames(styles['model-transformation__container'], { [styles.disabled]: disabled })}>
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-move'],
                            {
                                [styles.selected]: transformMode === 'translate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('translate');
                        }}
                        disabled={disabled}
                    />
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-scale'],
                            {
                                [styles.selected]: transformMode === 'scale'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('scale');
                        }}
                        disabled={disabled}
                    />
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-rotate'],
                            {
                                [styles.selected]: transformMode === 'rotate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('rotate');
                        }}
                        disabled={disabled}
                    />
                </div>
                {!disabled && transformMode === 'translate' && (
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
                {!disabled && transformMode === 'scale' && (
                    <div className={classNames(styles.panel, styles['scale-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={0}
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
                                    min={0}
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
                                    min={0}
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

                {!disabled && transformMode === 'rotate' && (
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

    return {
        size: machine.size,
        selectedModelArray: modelGroup.selectedModelArray,
        transformation: modelGroup.getSelectedModelTransformationForPrinting(),
        hasModel,
        transformMode
    };
};

const mapDispatchToProps = (dispatch) => ({
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation) => dispatch(printingActions.updateSelectedModelTransformation(transformation)),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerModelTransformation);
