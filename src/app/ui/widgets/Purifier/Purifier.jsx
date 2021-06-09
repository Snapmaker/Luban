import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import styles from './index.styl';
import {
    SPEED_HIGH,
    SPEED_MEDIUM,
    SPEED_LOW
} from '../../../constants';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { actions as machineActions } from '../../../flux/machine';

class Purifier extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired,
        airPurifier: PropTypes.bool.isRequired,
        airPurifierSwitch: PropTypes.bool.isRequired,
        airPurifierFanSpeed: PropTypes.number.isRequired,
        airPurifierFilterHealth: PropTypes.number.isRequired,
        server: PropTypes.object.isRequired
    };

    state = {
        isFilterEnable: true,
        workSpeed: SPEED_HIGH,
        filterLife: 2
    };

    actions = {
        onHandleFilterEnabled: () => {
            const { isFilterEnable, workSpeed } = this.state;
            if (this.props.connectionType === 'wifi') {
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
            if (this.props.connectionType === 'wifi') {
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
                if (this.state.isFilterEnable) {
                    this.props.executeGcode(`M1011 F${workSpeed};`);
                }
            }
            this.setState({
                workSpeed: workSpeed
            });
        }
    };

    constructor(props) {
        super(props);
        props.widgetActions.setTitle(i18n._('Air Purifier'));
    }

    componentDidMount() {
        if (!this.props.isConnected) {
            this.props.widgetActions.setDisplay(false);
            return;
        }
        if (!this.props.airPurifier) {
            this.props.widgetActions.setDisplay(false);
            return;
        }
        if (this.props.airPurifier) {
            this.props.widgetActions.setDisplay(true);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!nextProps.isConnected) {
            this.props.widgetActions.setDisplay(false);
            return;
        }
        if (!nextProps.airPurifier) {
            this.props.widgetActions.setDisplay(false);
            return;
        }
        if (nextProps.airPurifier) {
            this.props.widgetActions.setDisplay(true);
        }

        if (nextProps.airPurifierSwitch !== this.state.isFilterEnable) {
            this.setState({
                isFilterEnable: nextProps.airPurifierSwitch
            });
        }
        if (nextProps.airPurifierFanSpeed !== this.state.workSpeed) {
            this.setState({
                workSpeed: nextProps.airPurifierFanSpeed
            });
        }
        if (nextProps.airPurifierFilterHealth !== this.state.filterLife) {
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
                        <span className="sm-parameter-row__label-lg">{i18n._('Switch')}</span>
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
                                type="button"
                                className={classNames(
                                    (workSpeed === SPEED_LOW) ? styles.active : styles.passive,
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(SPEED_LOW)}
                            >
                                {i18n._('Low')}
                            </button>
                            <button
                                type="button"
                                className={classNames(
                                    (workSpeed === SPEED_MEDIUM) ? styles.active : styles.passive,
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(SPEED_MEDIUM)}
                            >
                                {i18n._('Medium')}
                            </button>
                            <button
                                type="button"
                                className={classNames(
                                    (workSpeed === SPEED_HIGH) ? styles.active : styles.passive,
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(SPEED_HIGH)}
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
    const { isConnected, server, connectionType, airPurifier, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth } = state.machine;
    return {
        isConnected,
        connectionType,
        airPurifier,
        airPurifierSwitch,
        airPurifierFanSpeed,
        airPurifierFilterHealth,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Purifier);
