import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import { ACTION_3DP_HIDDEN_OPERATION_PANELS, BOUND_SIZE } from '../../constants';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';

class VisualizerModelOperations extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            onChangeMx: PropTypes.func,
            onAfterChangeMx: PropTypes.func,
            onChangeMy: PropTypes.func,
            onAfterChangeMy: PropTypes.func,
            onChangeMz: PropTypes.func,
            onAfterChangeMz: PropTypes.func,
            onChangeS: PropTypes.func,
            onAfterChangeS: PropTypes.func,
            onChangeRx: PropTypes.func,
            onAfterChangeRx: PropTypes.func,
            onChangeRy: PropTypes.func,
            onAfterChangeRy: PropTypes.func,
            onChangeRz: PropTypes.func,
            onAfterChangeRz: PropTypes.func
        }),
        state: PropTypes.shape({
            stage: PropTypes.number.isRequired,
            moveX: PropTypes.number.isRequired,
            moveZ: PropTypes.number.isRequired,
            scale: PropTypes.number.isRequired,
            rotateX: PropTypes.number.isRequired,
            rotateY: PropTypes.number.isRequired,
            rotateZ: PropTypes.number.isRequired
        })
    };

    actions = {
        onChangeFactor: (type, value) => {
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
            this.props.actions.selectedModelChange();
        },

        onAfterChangeFactor: (type, value) => {
            this.actions.onChangeFactor(type, value);
            // todo: record state of mesh(for undo/redo...)
            this.props.state.selectedModel.clingToBottom();
            this.props.state.selectedModel.checkBoundary();
        }
    };

    componentDidMount() {
        this.subscribe();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_3DP_HIDDEN_OPERATION_PANELS, () => {
                this.setState({
                    showMovePanel: false,
                    showScalePanel: false,
                    showRotatePanel: false
                });
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.props.state;
        const actions = { ...this.props.actions, ...this.actions };
        const disabled = (state.selectedModel === undefined);

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
                            [styles.selected]: state.operateMode === 'translate'
                        }
                    )}
                    onClick={() => {
                        actions.setOperateMode('translate');
                    }}
                    disabled={disabled}
                />
                <Anchor
                    componentClass="button"
                    className={classNames(
                        styles['model-operation'],
                        styles['operation-scale'],
                        {
                            [styles.selected]: state.operateMode === 'scale'
                        }
                    )}
                    onClick={() => {
                        actions.setOperateMode('scale');
                    }}
                    disabled={disabled}
                />
                <Anchor
                    componentClass="button"
                    className={classNames(
                        styles['model-operation'],
                        styles['operation-rotate'],
                        {
                            [styles.selected]: state.operateMode === 'rotate'
                        }
                    )}
                    onClick={() => {
                        actions.setOperateMode('rotate');
                    }}
                    disabled={disabled}
                />
                {!disabled && state.operateMode === 'translate' &&
                <div className={classNames(styles.panel, styles['move-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={moveX}
                                onChange={(value) => {
                                    actions.onAfterChangeFactor('moveX', value);
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
                                    actions.onChangeFactor('moveX', value);
                                }}
                                onAfterChange={(value) => {
                                    actions.onAfterChangeFactor('moveX', value);
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
                                    actions.onAfterChangeFactor('moveZ', value);
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
                                    actions.onChangeFactor('moveZ', value);
                                }}
                                onAfterChange={(value) => {
                                    actions.onAfterChangeFactor('moveZ', value);
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
                {!disabled && state.operateMode === 'scale' &&
                <div className={classNames(styles.panel, styles['scale-panel'])} style={{ width: '160px' }}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={0}
                                value={scale}
                                onChange={(value) => {
                                    actions.onAfterChangeFactor('scale', value / 100);
                                }}
                            />
                            {false &&
                                <input
                                    type="checkbox"
                                    checked={state.uniformScale}
                                    onChange={(event) => {
                                        actions.setUniformScale(event.target.checked);
                                    }}
                                />
                            }
                        </span>
                        <span className={styles['axis-unit-2']}>%</span>
                    </div>
                </div>
                }
                {!disabled && state.operateMode === 'rotate' &&
                <div className={classNames(styles.panel, styles['rotate-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-180}
                                max={180}
                                value={rotateX}
                                onChange={(degree) => {
                                    actions.onAfterChangeFactor('rotateX', THREE.Math.degToRad(degree));
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
                                    actions.onChangeFactor('rotateX', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterChangeFactor('rotateX', THREE.Math.degToRad(degree));
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
                                    actions.onAfterChangeFactor('rotateZ', THREE.Math.degToRad(degree));
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
                                    actions.onChangeFactor('rotateZ', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterChangeFactor('rotateZ', THREE.Math.degToRad(degree));
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
                                    actions.onAfterChangeFactor('rotateY', THREE.Math.degToRad(degree));
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
                                    actions.onChangeFactor('rotateY', THREE.Math.degToRad(degree));
                                }}
                                onAfterChange={(degree) => {
                                    actions.onAfterChangeFactor('rotateY', THREE.Math.degToRad(degree));
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

export default VisualizerModelOperations;
