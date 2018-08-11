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
        actions: PropTypes.shape({
            onModelTransform: PropTypes.func.isRequired,
            onModelAfterTransform: PropTypes.func.isRequired
        }),
        state: PropTypes.shape({
            stage: PropTypes.number.isRequired,
            selectedModel: PropTypes.object,
            transformMode: PropTypes.string.isRequired,
            moveX: PropTypes.number.isRequired,
            moveZ: PropTypes.number.isRequired,
            scale: PropTypes.number.isRequired,
            rotateX: PropTypes.number.isRequired,
            rotateY: PropTypes.number.isRequired,
            rotateZ: PropTypes.number.isRequired
        })
    };

    actions = {
        onTransform: (type, value) => {
            switch (type) {
            case 'moveX':
                value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                this.props.state.selectedModel.position.x = value;
                break;
            case 'moveY':
                value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                this.props.state.selectedModel.position.y = value;
                break;
            case 'moveZ':
                value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
                value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
                this.props.state.selectedModel.position.z = value;
                break;
            case 'scale':
                this.props.state.selectedModel.scale.set(value, value, value);
                break;
            case 'rotateX':
                this.props.state.selectedModel.rotation.x = value;
                break;
            case 'rotateY':
                this.props.state.selectedModel.rotation.y = value;
                break;
            case 'rotateZ':
                this.props.state.selectedModel.rotation.z = value;
                break;
            default:
                break;
            }
            this.props.actions.onModelTransform();
        },
        onAfterTransform: (type, value) => {
            this.props.actions.onModelAfterTransform();
        }
    };

    render() {
        const state = this.props.state;
        const actions = { ...this.props.actions, ...this.actions };
        const disabled = !(state.stage === STAGES_3DP.modelLoaded && state.selectedModel);

        const moveX = Number(state.moveX.toFixed(1));
        const moveZ = Number(state.moveZ.toFixed(1));
        const scale = Number((state.scale * 100).toFixed(1));
        const rotateX = Number(THREE.Math.radToDeg(state.rotateX).toFixed(1));
        const rotateY = Number(THREE.Math.radToDeg(state.rotateY).toFixed(1));
        const rotateZ = Number(THREE.Math.radToDeg(state.rotateZ).toFixed(1));

        return (
            <React.Fragment>
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
                                    actions.onTransform('moveX', value);
                                    actions.onAfterTransform('moveX', value);
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
                                    actions.onTransform('moveX', value);
                                }}
                                onAfterChange={(value) => {
                                    actions.onAfterTransform('moveX', value);
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
                                    actions.onTransform('moveZ', value);
                                    actions.onAfterTransform('moveZ', value);
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
                                    actions.onTransform('moveZ', value);
                                }}
                                onAfterChange={(value) => {
                                    actions.onAfterTransform('moveZ', value);
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
                {!disabled && state.transformMode === 'scale' &&
                <div className={classNames(styles.panel, styles['scale-panel'])} style={{ width: '160px' }}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={0}
                                value={scale}
                                onChange={(value) => {
                                    actions.onTransform('scale', value / 100);
                                    actions.onAfterTransform('scale', value / 100);
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
                                    actions.onTransform('rotateX', THREE.Math.degToRad(degree));
                                    actions.onAfterTransform('rotateX', THREE.Math.degToRad(degree));
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
                                    actions.onTransform('rotateX', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterTransform('rotateX', THREE.Math.degToRad(degree));
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
                                    actions.onTransform('rotateZ', THREE.Math.degToRad(degree));
                                    actions.onAfterTransform('rotateZ', THREE.Math.degToRad(degree));
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
                                    actions.onTransform('rotateZ', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterTransform('rotateZ', THREE.Math.degToRad(degree));
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
                                    actions.onTransform('rotateY', THREE.Math.degToRad(degree));
                                    actions.onAfterTransform('rotateY', THREE.Math.degToRad(degree));
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
                                    actions.onTransform('rotateY', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterTransform('rotateY', THREE.Math.degToRad(degree));
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
