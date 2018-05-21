import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import Widget from '../../components/Widget';
import api from '../../api';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import WidgetConfig from '../WidgetConfig';
import Connection from './Connection';
import styles from './index.styl';


/**
 * Connection Widget
 */
class ConnectionWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);
    state = this.getInitialState();
    actions = {
        toggleFullscreen: () => {
            this.setState(state => ({
                minimized: state.isFullscreen ? state.minimized : false,
                isFullscreen: !state.isFullscreen
            }));
        },
        toggleMinimized: () => {
            this.setState(state => ({
                minimized: !state.minimized
            }));
        },
        clearAlert: () => {
            this.setState({
                alertMessage: ''
            });
        },
        onChangePortOption: (option) => {
            this.setState(state => ({
                alertMessage: '',
                port: option.value
            }));
        },
        handleRefreshPorts: (event) => {
            this.refreshPorts();
        },
        handleOpenPort: (event) => {
            const { port, baudrate } = this.state;
            this.openPort(port, { baudrate: baudrate });
        },
        handleClosePort: (event) => {
            const { port } = this.state;
            this.closePort(port);
        }
    };

    controllerEvents = {
        'serialport:list': (ports) => {
            log.debug('Received a list of serial ports:', ports);

            this.stopLoadingPorts();

            const port = this.config.get('port') || '';

            if (_.includes(_.map(ports, 'port'), port)) {
                this.setState({
                    alertMessage: '',
                    port: port,
                    ports: ports
                });

                const { autoReconnect, hasReconnected } = this.state;

                if (autoReconnect && !hasReconnected) {
                    const { baudrate } = this.state;

                    this.setState({
                        hasReconnected: true
                    });
                    this.openPort(port, {
                        baudrate: baudrate
                    });
                }
            } else {
                this.setState(state => ({
                    alertMessage: '',
                    ports: ports
                }));
            }
        },
        'serialport:open': (options) => {
            const { port, baudrate, inuse } = options;
            const ports = _.map(this.state.ports, (o) => {
                if (o.port !== port) {
                    return o;
                }

                o = { ...o, inuse };

                return o;
            });

            this.setState(state => ({
                alertMessage: '',
                connecting: false,
                connected: true,
                port: port,
                baudrate: baudrate,
                ports: ports
            }));

            log.debug('Connected to \'' + port + '\' at ' + baudrate + '.');
        },
        'serialport:close': (options) => {
            const { port } = options;

            this.setState(state => ({
                alertMessage: '',
                connecting: false,
                connected: false
            }));

            log.debug('Disconnected from \'' + port + '\'.');
        },
        'serialport:error': (options) => {
            const { port } = options;

            this.setState(state => ({
                alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port: port }),
                connecting: false,
                connected: false
            }));

            log.error('Error opening serial port \'' + port + '\'');
        }
    };

    componentDidMount() {
        this.addControllerEvents();
        this.refreshPorts();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    componentDidUpdate() {
        const {
            minimized,
            port,
            baudrate,
            autoReconnect
        } = this.state;

        this.config.set('minimized', minimized);
        if (port) {
            this.config.set('port', port);
        }
        if (baudrate) {
            this.config.set('baudrate', baudrate);
        }
        this.config.set('autoReconnect', autoReconnect);
    }

    getInitialState() {
        // Common baud rates
        const defaultBaudrates = [
            250000,
            115200,
            57600,
            38400,
            19200,
            9600,
            2400
        ];
        const baudrates = _.reverse(_.sortBy(_.uniq(controller.baudrates.concat(defaultBaudrates))));

        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false,
            // loading available ports
            loading: false,
            // connect to port
            connecting: false,
            connected: false,
            autoReconnect: this.config.get('autoReconnect'),
            hasReconnected: false,
            alertMessage: '',
            ports: [],
            port: controller.port,
            baudrates: baudrates,
            baudrate: this.config.get('baudrate')
        };
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

    startLoadingPorts() {
        const delay = 5 * 1000; // wait for 5 seconds

        this.setState({ loading: true });
        this._loadingTimer = setTimeout(() => {
            this.setState({ loading: false });
        }, delay);
    }

    stopLoadingPorts() {
        if (this._loadingTimer) {
            clearTimeout(this._loadingTimer);
            this._loadingTimer = null;
        }
        this.setState({ loading: false });
    }

    refreshPorts() {
        controller.listPorts();
        this.startLoadingPorts();
    }

    openPort(port, options) {
        const { baudrate } = options;

        this.setState({
            connecting: true
        });

        controller.openPort(port, { baudrate: baudrate }, (err) => {
            if (err) {
                this.setState({
                    alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port: port }),
                    connecting: false,
                    connected: false
                });

                log.error(err);
                return;
            }

            let name = '';
            let gcode = '';

            api.controllers.get()
                .then((res) => {
                    let next;
                    const c = _.find(res.body, { port: port });
                    if (c) {
                        next = api.fetchGCode({ port: port });
                    }
                    return next;
                })
                .then((res) => {
                    name = _.get(res, 'body.name', '');
                    gcode = _.get(res, 'body.data', '');
                })
                .catch((res) => {
                    // Empty block
                })
                .then(() => {
                    if (gcode) {
                        pubsub.publish('gcode:load', { name, gcode });
                    }
                });
        });
    }

    closePort(port = this.state.port) {
        this.setState({
            connecting: false,
            connected: false
        });
        controller.closePort(port, (err) => {
            if (err) {
                log.error(err);
                return;
            }

            // Refresh ports
            controller.listPorts();
        });
    }

    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen } = this.state;
        const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
        const state = this.state;
        const actions = this.actions;

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <span className="space" />
                        </Widget.Sortable>
                        {i18n._('Connection')}
                        {isForkedWidget &&
                        <i className="fa fa-code-fork" style={{ marginLeft: 5 }} />
                        }
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={actions.toggleMinimized}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    'fa-fw',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isFullscreen },
                                        { 'fa-compress': isFullscreen }
                                    )}
                                />
                                <span className="space space-sm" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: minimized }
                    )}
                >
                    <Connection state={state} actions={actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default ConnectionWidget;
