import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
// import controller from '../../lib/controller';
import Notifications from '../../components/Notifications';

import SerialConnection from './ScreenConnection';
import { screenController } from '../../lib/controller';


class Connection extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        dataSource: PropTypes.string.isRequired
    };

    state = {
        // connection types: serial
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
        }
    };

    controllerEvents = {
        'serialport:open': (options) => this.onPortOpened(options),
        'serialport:close': (options) => this.onPortClosed(options)
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Connection'));
    }

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    onPortOpened(options) {
        const { dataSource } = options;
        if (dataSource !== this.props.dataSource) {
            return;
        }
        this.setState({ connected: true });
    }

    onPortClosed(options) {
        const { dataSource } = options;
        if (dataSource !== this.props.dataSource) {
            return;
        }
        this.setState({ connected: false });
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.off(eventName, callback);
        });
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
                </div>
                {connectionType === 'serial' && (
                    <SerialConnection
                        dataSource={this.props.dataSource}
                        style={{ marginTop: '10px' }}
                    />
                )}
            </div>
        );
    }
}
const mapStateToProps = (state, ownPros) => {
    const { widgets } = state.widget;
    const { widgetId } = ownPros;
    const dataSource = widgets[widgetId].dataSource;

    return {
        dataSource
    };
};
export default connect(mapStateToProps)(Connection);
