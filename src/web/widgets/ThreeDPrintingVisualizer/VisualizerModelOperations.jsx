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
            onChangeFile: PropTypes.func
        }),
        state: PropTypes.object
    };

    state = {
        showMovePanel: false,
        move: {
            x: 0,
            y: 0,
            z: 0
        }
    };

    actions = {
        onToggleMovePanel: () => {
            this.setState((state) => ({
                showMovePanel: !state.showMovePanel
            }));
        },
        onChangeMoveX: (value) => {
            console.log('moveX', value);
            const move = { ...this.state.move, x: value };
            console.log('move', move);
            this.setState({ move });
        },
        onAfterChangeMoveX: () => {
            console.error('onAfterChangeMoveX');
        },
        onToggleScalePanel: () => {
            console.error('Toggle Scale Panel');
        },
        onToggleRotatePanel: () => {
            console.error('Toggle Rotate Panel');
        }
    };

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
                                value={state.move.x}
                                onChange={(value) => {
                                    actions.onChangeMoveX(value);
                                    actions.onAfterChangeMoveX(value);
                                }}
                            />
                        </span>
                        <span className={styles['axis-slider']}>
                            <Slider
                                handleStyle={{
                                    borderColor: 'white',
                                    backgroundColor: '#22ac38'
                                }}
                                trackStyle={{
                                    backgroundColor: '#e9e9e9'
                                }}
                                value={state.move.x}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveX}
                                onAfterChange={actions.onAfterChangeMoveX}
                            />
                        </span>
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-green'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={state.move.x}
                                onChange={(value) => {
                                    actions.onChangeMoveX(value);
                                    actions.onAfterChangeMoveX(value);
                                }}
                            />
                        </span>
                        <span className={styles['axis-slider']}>
                            <Slider
                                handleStyle={{
                                    borderColor: 'white',
                                    backgroundColor: '#e83100'
                                }}
                                trackStyle={{
                                    backgroundColor: '#e9e9e9'
                                }}
                                value={state.move.x}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveX}
                                onAfterChange={actions.onAfterChangeMoveX}
                            />
                        </span>
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-green'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={state.move.x}
                                onChange={(value) => {
                                    actions.onChangeMoveX(value);
                                    actions.onAfterChangeMoveX(value);
                                }}
                            />
                        </span>
                        <span className={styles['axis-slider']}>
                            <Slider
                                handleStyle={{
                                    borderColor: 'white',
                                    backgroundColor: '#e83100'
                                }}
                                trackStyle={{
                                    backgroundColor: '#e9e9e9'
                                }}
                                value={state.move.x}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={actions.onChangeMoveX}
                                onAfterChange={actions.onAfterChangeMoveX}
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
