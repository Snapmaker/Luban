import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { connect } from 'react-redux';
import { Button } from '@trendmicro/react-buttons';
import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI, EXPERIMENTAL_WIFI_CONTROL, MACHINE_SERIES, PROTOCOL_TEXT } from '../../constants';
import i18n from '../../lib/i18n';
// import controller from '../../lib/controller';
import Notifications from '../../components/Notifications';

import SerialConnection from './SerialConnection';
import WifiConnection from './WifiConnection';
import { actions as machineActions } from '../../flux/machine';
import Modal from '../../components/Modal';


class Connection extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        dataSource: PropTypes.string.isRequired,
        connectionType: PropTypes.string.isRequired,
        series: PropTypes.string.isRequired,
        isHomed: PropTypes.bool,
        isConnected: PropTypes.bool.isRequired,
        updateConnectionState: PropTypes.func.isRequired,
        executeGcodeAutoHome: PropTypes.func.isRequired
    };

    state = {
        alertMessage: '',
        showHomeReminder: false
    };

    actions = {
        clearAlert: () => {
            this.setState({
                alertMessage: ''
            });
        },
        onSelectTabSerial: () => {
            this.props.updateConnectionState({
                connectionType: CONNECTION_TYPE_SERIAL
            });
        },
        onSelectTabWifi: () => {
            this.props.updateConnectionState({
                connectionType: CONNECTION_TYPE_WIFI
            });
        },
        openHomeModal: () => {
            this.setState({
                showHomeReminder: true
            });
        },
        closeHomeModal: () => {
            this.setState({
                showHomeReminder: false
            });
        },
        clickHomeModalOk: () => {
            this.props.executeGcodeAutoHome();
            this.setState({
                showHomeReminder: false
            });
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Connection'));
    }

    componentWillReceiveProps(nextProps) {
        const { isHomed } = nextProps;
        if (this.props.isHomed !== isHomed && !isHomed) {
            if (this.props.dataSource === PROTOCOL_TEXT) {
                this.actions.openHomeModal();
            }
        }
        if (this.props.isHomed !== isHomed && isHomed) {
            if (this.props.dataSource === PROTOCOL_TEXT) {
                this.actions.closeHomeModal();
            }
        }
    }

    render() {
        const { connectionType, isConnected, series, isHomed } = this.props;
        const { alertMessage, showHomeReminder } = this.state;
        const isOriginal = series === MACHINE_SERIES.ORIGINAL.value;

        return (
            <div>
                {alertMessage && (
                    <Notifications bsStyle="danger" onDismiss={this.actions.clearAlert}>
                        {alertMessage}
                    </Notifications>
                )}

                {EXPERIMENTAL_WIFI_CONTROL && (
                    <div className="sm-tabs">
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': (connectionType === CONNECTION_TYPE_SERIAL) })}
                            onClick={this.actions.onSelectTabSerial}
                            disabled={isConnected}
                        >
                            {i18n._('Serial Port')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': (connectionType === CONNECTION_TYPE_WIFI) })}
                            onClick={this.actions.onSelectTabWifi}
                            disabled={isConnected}
                        >
                            {i18n._('Wi-Fi')}
                        </button>
                    </div>
                )}
                {!EXPERIMENTAL_WIFI_CONTROL && (
                    <p>{i18n._('Serial Port')}</p>
                )}
                {connectionType === CONNECTION_TYPE_SERIAL && (
                    <SerialConnection
                        dataSource={this.props.dataSource}
                        style={{ marginTop: '10px' }}
                    />
                )}
                {connectionType === CONNECTION_TYPE_WIFI && (
                    <WifiConnection
                        style={{ marginTop: '10px' }}
                    />
                )}
                {isConnected && showHomeReminder && !isOriginal && isHomed !== null && !isHomed && (
                    <Modal disableOverlay size="sm" showCloseButton={false}>
                        <Modal.Header>
                            <Modal.Title>
                                {i18n._('Home Reminder')}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <div>
                                {i18n._('To continue, the machine needs to go to its home position. Homing works by moving X, Y, Z axes to the pre-defined positions, which will be used as the reference points.')}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                btnStyle="primary"
                                onClick={this.actions.clickHomeModalOk}
                            >
                                {i18n._('OK')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )}
            </div>
        );
    }
}
const mapStateToProps = (state, ownPros) => {
    const { widgets } = state.widget;
    const dataSource = widgets[ownPros.widgetId].dataSource;

    const { connectionType, isConnected, series, isHomed } = state.machine;

    return {
        dataSource,
        connectionType,
        isConnected,
        series,
        isHomed
    };
};

const mapDispatchToProps = (dispatch) => ({
    executeGcodeAutoHome: () => dispatch(machineActions.executeGcodeAutoHome()),
    updateConnectionState: (state) => dispatch(machineActions.updateConnectionState(state))
});

export default connect(mapStateToProps, mapDispatchToProps)(Connection);
