import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import SerialConnection from './SerialConnection';


class Connection extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired
    };

    state = {
        // connection types: serial, wifi
        connectionType: 'serial',
        connected: false,
        alertMessage: ''
    };

    actions = {
        clearAlert: () => {
            this.setState({
                alertMessage: ''
            });
        },
        onSelectTabSerial: () => {
            this.setState({
                connectionType: 'serial'
            });
        },
        onSelectTabWifi: () => {
            this.setState({
                connectionType: 'wifi'
            });
        }
    };

    controllerEvents = {
        'serialport:open': (options) => this.onPortOpened(options),
        'serialport:close': (options) => this.onPortClosed(options)
    };

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    onPortOpened(options) {
        this.setState({ connected: true });
    }

    onPortClosed(options) {
        this.setState({ connected: false });
    }

    render() {
        const { connectionType, connected, alertMessage } = this.state;

        return (
            <div>
                {alertMessage && (
                    <Notifications bsStyle="danger" onDismiss={this.actions.clearAlert}>
                        {alertMessage}
                    </Notifications>
                )}
                <div className="sm-tabs">
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': (connectionType === 'serial') })}
                        onClick={this.actions.onSelectTabSerial}
                        disabled={connected}
                    >
                        {i18n._('Serial Port')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': (connectionType === 'wifi') })}
                        onClick={this.actions.onSelectTabWifi}
                        disabled={connected}
                    >
                        {i18n._('Wi-Fi')}
                    </button>
                </div>
                {connectionType === 'serial' && (
                    <SerialConnection
                        style={{ marginTop: '10px' }}
                        config={this.props.config}
                    />
                )}
            </div>
        );
    }
}

export default Connection;
