import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import styles from './index.styl';
import {
    FILTER_SPEED_HIGH,
    FILTER_SPEED_MEDIUM,
    FILTER_SPEED_LOW
} from '../../constants';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import { actions as machineActions } from '../../flux/machine';

class Filter extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        setDisplay: PropTypes.func.isRequired,
        server: PropTypes.object.isRequired,
        connectionType: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired,
        airPurifierSwitch: PropTypes.bool,
        airPurifierFanSpeed: PropTypes.number,
        airPurifierFilterHealth: PropTypes.number
    };

    state = {
        isFilterEnable: true,
        workSpeed: FILTER_SPEED_HIGH,
        filterLife: 2
    };

    actions = {
        onHandleFilterEnabled: () => {
            const { isFilterEnable, workSpeed } = this.state;
            if (this.props.connectionType === 'wifi') { // todo, 'wifi'
                this.props.server.setFilterSwitch(!isFilterEnable, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        this.setState({
                            isFilterEnable: res.airPurifierSwitch
                        });
                    }
                });
            } else {
                this.props.executeGcode(`M1011 F${isFilterEnable ? 0 : workSpeed};`);
            }
            this.setState({
                isFilterEnable: !this.state.isFilterEnable
            });
        },
        onChangeFilterSpeed: (workSpeed) => {
            if (this.props.connectionType === 'wifi') { // todo, 'wifi'
                this.props.server.setFilterWorkSpeed(workSpeed, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        this.setState({
                            workSpeed: res.airPurifierFanSpeed
                        });
                    }
                });
            } else {
                this.props.executeGcode(`M1011 F${workSpeed};`);
            }
            this.setState({
                workSpeed: workSpeed
            });
        }
    };

    componentDidMount() {
    }

    componentWillReceiveProps(nextProps) {
        console.log('next', nextProps);
        if (!nextProps.isConnected) {
            this.props.setDisplay(false);
            return;
        }
        if (nextProps.airPurifierSwitch === undefined) {
            this.props.setDisplay(false);
            return;
        }
        if (nextProps.airPurifierSwitch !== undefined) {
            this.props.setDisplay(true);
        }

        if (nextProps.airPurifierSwitch !== this.props.airPurifierSwitch) {
            this.setState({
                isFilterEnable: nextProps.airPurifierSwitch
            });
        }
        if (nextProps.airPurifierFanSpeed !== this.props.airPurifierFanSpeed) {
            this.setState({
                workSpeed: nextProps.airPurifierFanSpeed
            });
        }
        if (nextProps.airPurifierFilterHealth !== this.props.airPurifierFilterHealth) {
            this.setState({
                filterLife: nextProps.airPurifierFilterHealth
            });
        }
    }

    render() {
        const { isFilterEnable, workSpeed, filterLife } = this.state;
        return (
            <div>
                <div className="sm-parameter-container">
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Filter')}</span>
                        <button
                            type="button"
                            className={classNames(
                                'sm-btn-small',
                                isFilterEnable ? 'sm-btn-primary' : 'sm-btn-danger'
                            )}
                            style={{
                                float: 'right'
                            }}
                            onClick={this.actions.onHandleFilterEnabled}
                        >
                            {!isFilterEnable && <i className="fa fa-toggle-off" />}
                            {!!isFilterEnable && <i className="fa fa-toggle-on" />}
                            <span className="space" />
                            {isFilterEnable ? i18n._('On') : i18n._('Off')}
                        </button>
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Work Speed')}</span>
                        <span
                            className={classNames(
                                styles['btn-3btns']
                            )}
                        >
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_LOW) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_LOW)}
                            >
                                {i18n._('Low')}
                            </button>
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_MEDIUM) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_MEDIUM)}
                            >
                                {i18n._('Medium')}
                            </button>
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_HIGH) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_HIGH)}
                            >
                                {i18n._('High')}
                            </button>
                        </span>
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Filter Life')}</span>
                        <span
                            className={classNames(
                                styles.lifeLength
                            )}
                        >
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 0 ? styles.active : styles.passive
                                )}
                            />
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 1 ? styles.active : styles.passive
                                )}
                            />
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 2 ? styles.active : styles.passive
                                )}
                            />
                        </span>
                    </div>
                    {(filterLife === 0) && (
                        <div className={classNames(styles.notice)}>
                            {i18n._('The filter element needs to be replaced.')}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { isConnected, server, connectionType, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth } = state.machine;
    return {
        isConnected,
        server,
        connectionType,
        airPurifierSwitch,
        airPurifierFanSpeed,
        airPurifierFilterHealth
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Filter);
