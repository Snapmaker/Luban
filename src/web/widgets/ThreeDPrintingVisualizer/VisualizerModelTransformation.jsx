import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import { BOUND_SIZE, STAGES_3DP } from '../../constants';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';


class VisualizerModelTransformation extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            stage: PropTypes.number.isRequired,
            transformMode: PropTypes.string.isRequired
        }),
        actions: PropTypes.shape({
            setTransformMode: PropTypes.func.isRequired
        }),
        modelGroup: PropTypes.object.isRequired
    };

    state = {
        selectedModel: null,
        posX: 0,
        posY: 0,
        posZ: 0,
        scale: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0
    };

    constructor(props) {
        super(props);
        this.modelGroup = this.props.modelGroup;
        this.modelGroup.addChangeListener((args) => {
            const { model, position, scale, rotation } = args;
            this.setState({
                selectedModel: model,
                posX: position.x,
                posY: position.y,
                posZ: position.z,
                scale: scale.x,
                rotateX: rotation.x,
                rotateY: rotation.y,
                rotateZ: rotation.z
            });
        });
    }

    actions = {
        onModelTransform: (type, value) => {
            let transformations = {};
            switch (type) {
                case 'moveX':
                    value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                    value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                    transformations = { posX: value };
                    break;
                case 'moveY':
                    value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                    value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                    transformations = { posY: value };
                    break;
                case 'moveZ':
                    value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                    value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                    transformations = { posZ: value };
                    break;
                case 'scale':
                    transformations = { scale: new THREE.Vector3(value, value, value) };
                    break;
                case 'rotateX':
                    transformations = { rotateX: value };
                    break;
                case 'rotateY':
                    transformations = { rotateY: value };
                    break;
                case 'rotateZ':
                    transformations = { rotateZ: value };
                    break;
                default:
                    break;
            }
            this.modelGroup.transformSelectedModel(transformations, false);
        },
        onModelAfterTransform: () => {
            this.modelGroup.transformSelectedModel({}, true);
        }
    };

    render() {
        const state = { ...this.props.state, ...this.state };
        const actions = { ...this.props.actions, ...this.actions };
        const disabled = !(state.selectedModel && state.stage === STAGES_3DP.modelLoaded);

        const moveX = Number(state.posX.toFixed(1));
        const moveZ = Number(state.posZ.toFixed(1));
        const scale = Number((state.scale * 100).toFixed(1));
        const rotateX = Number(THREE.Math.radToDeg(state.rotateX).toFixed(1));
        const rotateY = Number(THREE.Math.radToDeg(state.rotateY).toFixed(1));
        const rotateZ = Number(THREE.Math.radToDeg(state.rotateZ).toFixed(1));

        return (
            <React.Fragment>
                <div className={classNames(styles['model-transformation__container'], { [styles.disabled]: disabled })}>
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-move'],
                            {
                                [styles.selected]: state.transformMode === 'translate'
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
                                [styles.selected]: state.transformMode === 'scale'
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
                                [styles.selected]: state.transformMode === 'rotate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('rotate');
                        }}
                        disabled={disabled}
                    />
                </div>
                {!disabled && state.transformMode === 'translate' &&
                <div className={classNames(styles.panel, styles['move-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={moveX}
                                onChange={(value) => {
                                    actions.onModelTransform('moveX', value);
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
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={(value) => {
                                    actions.onModelTransform('moveX', value);
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
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={moveZ}
                                onChange={(value) => {
                                    actions.onModelTransform('moveZ', value);
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
                                value={moveZ}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={(value) => {
                                    actions.onModelTransform('moveZ', value);
                                }}
                                onAfterChange={() => {
                                    actions.onModelAfterTransform();
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
                {!disabled && state.transformMode === 'scale' &&
                <div className={classNames(styles.panel, styles['scale-panel'])} >
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={0}
                                value={scale}
                                onChange={(value) => {
                                    actions.onModelTransform('scale', value / 100);
                                    actions.onModelAfterTransform();
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-2']}>%</span>
                    </div>
                </div>
                }
                {!disabled && state.transformMode === 'rotate' &&
                <div className={classNames(styles.panel, styles['rotate-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-180}
                                max={180}
                                value={rotateX}
                                onChange={(degree) => {
                                    actions.onModelTransform('rotateX', THREE.Math.degToRad(degree));
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
                                    actions.onModelTransform('rotateX', THREE.Math.degToRad(degree));
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
                                value={rotateZ}
                                onChange={(degree) => {
                                    actions.onModelTransform('rotateZ', THREE.Math.degToRad(degree));
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
                                value={rotateZ}
                                min={-180}
                                max={180}
                                step={0.1}
                                onChange={(degree) => {
                                    actions.onModelTransform('rotateZ', THREE.Math.degToRad(degree));
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
                                value={rotateY}
                                onChange={(degree) => {
                                    actions.onModelTransform('rotateY', THREE.Math.degToRad(degree));
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
                                value={rotateY}
                                min={-180}
                                max={180}
                                step={0.1}
                                onChange={(degree) => {
                                    actions.onModelTransform('rotateY', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={() => {
                                    actions.onModelAfterTransform();
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerModelTransformation;
