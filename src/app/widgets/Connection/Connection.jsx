import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { connect } from 'react-redux';
import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI, EXPERIMENTAL_WIFI_CONTROL } from '../../constants';
import i18n from '../../lib/i18n';
// import controller from '../../lib/controller';
import Notifications from '../../components/Notifications';

import SerialConnection from './SerialConnection';
import WifiConnection from './WifiConnection';
import { actions as machineActions } from '../../flux/machine';


class Connection extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        dataSource: PropTypes.string.isRequired,
        connectionType: PropTypes.string.isRequired,
        isConnected: PropTypes.bool.isRequired,
        updateConnectionState: PropTypes.func.isRequired
    };

    state = {
        alertMessage: ''
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
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Connection'));
    }


    render() {
        const { connectionType, isConnected } = this.props;
        const { alertMessage } = this.state;

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
            </div>
        );
    }
}
const mapStateToProps = (state, ownPros) => {
    const { widgets } = state.widget;
    const dataSource = widgets[ownPros.widgetId].dataSource;

    const { connectionType, isConnected } = state.machine;

    return {
        dataSource,
        connectionType,
        isConnected
    };
};

const mapDispatchToProps = (dispatch) => ({
    updateConnectionState: (state) => dispatch(machineActions.updateConnectionState(state))
});

export default connect(mapStateToProps, mapDispatchToProps)(Connection);
