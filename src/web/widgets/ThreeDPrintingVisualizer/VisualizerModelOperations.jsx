import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { BOUND_SIZE, STAGE_IMAGE_LOADED } from '../../constants';
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

    state = {
        showMovePanel: false,
        showScalePanel: false,
        showRotatePanel: false
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
        onBlur: (type, event) => {
            this.handleAfterChange(type, event);
        },
        onKeyUp: (type, event) => {
            event.keyCode === 13 && this.handleAfterChange(type, event);
        }
    };

    handleAfterChange = (type, event) => {
        let valueStr = event.target.value;
        if (valueStr.trim().length === 0) {
            return;
        }
        let value = parseFloat(valueStr);
        switch (type) {
        case 'moveX':
            value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
            value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
            this.props.actions.onAfterChangeMx(value);
            break;
        case 'moveY':
            value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
            value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
            this.props.actions.onAfterChangeMy(value);
            break;
        case 'moveZ':
            value = (value < -BOUND_SIZE / 2) ? (-BOUND_SIZE / 2) : value;
            value = (value > BOUND_SIZE / 2) ? (BOUND_SIZE / 2) : value;
            this.props.actions.onAfterChangeMz(value);
            break;
        case 'scale':
            this.props.actions.onAfterChangeS(value / 100);
            break;
        case 'rotateX':
            this.props.actions.onAfterChangeRx(value);
            break;
        case 'rotateY':
            this.props.actions.onAfterChangeRy(value);
            break;
        case 'rotateZ':
            this.props.actions.onAfterChangeRz(value);
            break;
        default:
            break;
        }
    };

    render() {
        const state = this.props.state;
        const disabled = state.stage < STAGE_IMAGE_LOADED;

        return (
            <React.Fragment>
                <Anchor
                    componentClass="button"
                    className={classNames(
                        styles['model-operation'],
                        styles['operation-move'],
                        {
                            [styles.selected]: this.state.showMovePanel
                        }
                    )}
                    onClick={this.actions.onToggleMovePanel}
                    disabled={disabled}
                />
                <Anchor
                    componentClass="button"
                    className={classNames(
                        styles['model-operation'],
                        styles['operation-scale'],
                        {
                            [styles.selected]: this.state.showScalePanel
                        }
                    )}
                    onClick={this.actions.onToggleScalePanel}
                    disabled={disabled}
                />
                <Anchor
                    componentClass="button"
                    className={classNames(
                        styles['model-operation'],
                        styles['operation-rotate'],
                        {
                            [styles.selected]: this.state.showRotatePanel
                        }
                    )}
                    onClick={this.actions.onToggleRotatePanel}
                    disabled={disabled}
                />
                {this.state.showMovePanel &&
                <div className={classNames(styles.panel, styles['move-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                value={this.props.state.moveX.toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('moveX', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('moveX', event);
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
                                value={this.props.state.moveX}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={(value) => {
                                    this.props.actions.onChangeMx(value);
                                }}
                                onAfterChange={(value) => {
                                    this.props.actions.onAfterChangeMx(value);
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
                                value={this.props.state.moveZ.toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('moveZ', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('moveZ', event);
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
                                value={this.props.state.moveZ}
                                min={-BOUND_SIZE / 2}
                                max={BOUND_SIZE / 2}
                                step={0.1}
                                onChange={(value) => {
                                    this.props.actions.onChangeMz(value);
                                }}
                                onAfterChange={(value) => {
                                    this.props.actions.onAfterChangeMz(value);
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
                {this.state.showScalePanel &&
                <div className={classNames(styles.panel, styles['scale-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                        <span className={styles['axis-input-1']}>
                            <Input
                                min={0}
                                max={200}
                                value={(this.props.state.scale * 100).toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('scale', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('scale', event);
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
                                value={this.props.state.scale * 100}
                                min={0}
                                max={200}
                                step={0.1}
                                onChange={(value) => {
                                    this.props.actions.onChangeS(value / 100);
                                }}
                                onAfterChange={(value) => {
                                    this.props.actions.onAfterChangeS(value / 100);
                                }}
                            />
                        </span>
                    </div>
                </div>
                }
                {this.state.showRotatePanel &&
                <div className={classNames(styles.panel, styles['rotate-panel'])}>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-blue'])}>X</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRx(this.props.state.rotateX + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={this.props.state.rotateX.toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('rotateX', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('rotateX', event);
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRx(this.props.state.rotateX - 1);
                            }}
                        />
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-red'])}>Y</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRy(this.props.state.rotateY + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={this.props.state.rotateY.toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('rotateY', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('rotateY', event);
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRy(this.props.state.rotateY - 1);
                            }}
                        />
                    </div>
                    <div className={styles.axis}>
                        <span className={classNames(styles['axis-label'], styles['axis-green'])}>Z</span>
                        <Anchor
                            className={classNames('fa', 'fa-plus', styles['axis-plus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRz(this.props.state.rotateZ + 1);
                            }}
                        />
                        <span className={styles['axis-input-2']}>
                            <Input
                                min={-180}
                                max={180}
                                value={this.props.state.rotateZ.toFixed(1)}
                                onChange={(value) => {
                                }}
                                onBlur={(event) => {
                                    this.actions.onBlur('rotateZ', event);
                                }}
                                onKeyUp={(event) => {
                                    this.actions.onKeyUp('rotateZ', event);
                                }}
                            />
                        </span>
                        <span className={styles['axis-unit-3']}>°</span>
                        <Anchor
                            className={classNames('fa', 'fa-minus', styles['axis-minus'])}
                            onClick={() => {
                                this.props.actions.onAfterChangeRz(this.props.state.rotateZ - 1);
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
