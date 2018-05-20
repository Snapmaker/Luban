import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { BOUND_SIZE } from '../../constants';
import Anchor from '../../components/Anchor';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './styles.styl';


class VisualizerModelOperations extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            onChangeFile: PropTypes.func,
            onModelOperationChanged: PropTypes.func
        }),
        state: PropTypes.object
    };

    state = {
        showMovePanel: false,
        showScalePanel: false,
        showRotatePanel: false,
        moveX: 0,
        moveY: 0,
        moveZ: 0,
        scale: 100,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0
    };

    actions = {
        onToggleMovePanel: () => {
            this.setState((state) => ({
                showMovePanel: !state.showMovePanel,
                showScalePanel: false,
                showRotatePanel: false
            }));
        },
        onToggleScalePanel: () => {
            this.setState((state) => ({
                showMovePanel: false,
                showScalePanel: !state.showScalePanel,
                showRotatePanel: false
            }));
        },
        onToggleRotatePanel: () => {
            this.setState((state) => ({
                showMovePanel: false,
                showScalePanel: false,
                showRotatePanel: !state.showRotatePanel
            }));
        },
        onChangeMoveX: (moveX) => {
            this.setState({ moveX });
        },
        onAfterChangeMoveX: (moveX) => {
            const actions = this.props.actions;
            actions.onModelOperationChanged({ moveX });
        },
        onChangeMoveY: (moveY) => {
            this.setState({ moveY });
        },
        onAfterChangeMoveY: (moveY) => {
            const actions = this.props.actions;
            actions.onModelOperationChanged({ moveY });
        },
        onChangeMoveZ: (moveZ) => {
            this.setState({ moveZ });
        },
        onAfterChangeMoveZ: (moveZ) => {
            const actions = this.props.actions;
            actions.onModelOperationChanged({ moveZ });
        },
        onChangeScale: (scale) => {
            this.setState({ scale });
        },
        onAfterChangeScale: (scale) => {
            const actions = this.props.actions;
            actions.onModelOperationChanged({ scale });
        },
        onChangeRotateX: (rotateX) => {
            if (rotateX < -180 || rotateX > 180) {
                return;
            }
            this.update({ rotateX });
        },
        onChangeRotateY: (rotateY) => {
            if (rotateY < -180 || rotateY > 180) {
                return;
            }
            this.update({ rotateY });
        },
        onChangeRotateZ: (rotateZ) => {
            if (rotateZ < -180 || rotateZ > 180) {
                return;
            }
            this.update({ rotateZ });
        }
    };

    update(state) {
        this.setState(state);

        const actions = this.props.actions;
        actions.onModelOperationChanged(state);
    }

    render() {
        const state = this.state;
        const actions = {
            ...this.props.actions,
            ...this.actions
        };

        return (
            <React.Fragment>
                <Anchor
                    className={styles['model-operation']}
                    onClick={actions.onToggleMovePanel}
                >
                    <div className={classNames(styles.icon, styles['icon-move'])} />
                </Anchor>
                <Anchor
                    className={styles['model-operation']}
                    onClick={actions.onToggleScalePanel}
                >
                    <div className={classNames(styles.icon, styles['icon-scale'])} />
                </Anchor>
                <Anchor
                    className={styles['model-operation']}
                    onClick={actions.onToggleRotatePanel}
                >
                    <div className={classNames(styles.icon, styles['icon-rotate'])} />
                </Anchor>
                {state.showMovePanel &&
                <div className={classNames(styles.panel, styles['move-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-green'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={state.moveX}
                                onChange={(value) => {
                                    actions.onChangeMoveX(value);
                                    actions.onAfterChangeMoveX(value);
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
                                value={state.moveX}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveX}
                                onAfterChange={actions.onAfterChangeMoveX}
                            />
                        </span>
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>Y</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={state.moveY}
                                onChange={(value) => {
                                    actions.onChangeMoveY(value);
                                    actions.onAfterChangeMoveY(value);
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
                                value={state.moveY}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveY}
                                onAfterChange={actions.onAfterChangeMoveY}
                            />
                        </span>
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>Z</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={state.moveZ}
                                onChange={(value) => {
                                    actions.onChangeMoveZ(value);
                                    actions.onAfterChangeMoveZ(value);
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-1']}>mm</span>
                        <span className={styles['axis-slider']}>
                            <Slider
                                handleStyle={{
                                    borderColor: 'white',
                                    backgroundColor: '#00b7ee'
                                }}
                                trackStyle={{
                                    backgroundColor: '#e9e9e9'
                                }}
                                value={state.moveZ}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveZ}
                                onAfterChange={actions.onAfterChangeMoveZ}
                            />
                        </span>
                    </div>
                </div>
                }
                { state.showScalePanel &&
                <div className={classNames(styles.panel, styles['scale-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={0}
                                max={200}
                                value={state.scale}
                                onChange={(value) => {
                                    actions.onChangeScale(value);
                                    actions.onAfterChangeScale(value);
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-2']}>%</span>
                        <span className={styles['axis-slider']}>
                            <Slider
                                handleStyle={{
                                    borderColor: 'white',
                                    backgroundColor: '#00b7ee'
                                }}
                                trackStyle={{
                                    backgroundColor: '#e9e9e9'
                                }}
                                value={state.scale}
                                min={0}
                                max={200}
                                step={0.1}
                                onChange={actions.onChangeScale}
                                onAfterChange={actions.onAfterChangeScale}
                            />
                        </span>
                    </div>
                </div>
                }
                { state.showRotatePanel &&
                <div className={classNames(styles.panel, styles['rotate-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>X</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                actions.onChangeRotateX(state.rotateX + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={state.rotateX}
                                onChange={actions.onChangeRotateX}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                actions.onChangeRotateX(state.rotateX - 1);
                            }}
                        />
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>Y</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                actions.onChangeRotateY(state.rotateY + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={state.rotateY}
                                onChange={actions.onChangeRotateY}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                actions.onChangeRotateY(state.rotateY - 1);
                            }}
                        />
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-green'])}>Z</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                actions.onChangeRotateZ(state.rotateZ + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={state.rotateZ}
                                onChange={actions.onChangeRotateZ}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                actions.onChangeRotateZ(state.rotateZ - 1);
                            }}
                        />
                    </div>
                </div>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerModelOperations;
