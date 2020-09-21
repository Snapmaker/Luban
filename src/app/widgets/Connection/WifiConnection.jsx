import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import { Button, InputGroup } from 'react-bootstrap';
import { map, includes } from 'lodash';

import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import Space from '../../components/Space';
import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_WIFI, IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING, IMAGE_WIFI_ERROR,
    IMAGE_WIFI_WAITING,
    MACHINE_HEAD_TYPE,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN
} from '../../constants';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import PrintingState from './PrintingState';
import LaserState from './LaserState';
import ModalSmall from '../../components/Modal/ModalSmall';
import ModalSmallInput from '../../components/Modal/ModalSmallInput';
import { Server } from '../../flux/machine/Server';

class WifiConnection extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        servers: PropTypes.array.isRequired,
        discovering: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        isOpen: PropTypes.bool.isRequired,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        connectionStatus: PropTypes.string.isRequired,
        manualIp: PropTypes.string,

        discoverServers: PropTypes.func.isRequired,
        openServer: PropTypes.func.isRequired,
        closeServer: PropTypes.func.isRequired,
        updateServer: PropTypes.func.isRequired,
        updateManualIp: PropTypes.func.isRequired,
        setServer: PropTypes.func.isRequired
    };

    state = {
        server: this.props.server,
        showConnectionMessage: false,
        connectionMessage: {
            text: '',
            title: '',
            img: IMAGE_WIFI_WAITING,
            showCloseButton: false,
            onCancel: null,
            onConfirm: null
        },
        showManualWiFi: false,
        manualWiFi: {
            text: '',
            title: '',
            label: '',
            img: IMAGE_WIFI_CONNECTED,
            showCloseButton: false,
            onCancel: null,
            onConfirm: null
        }
    };

    actions = {
        onRefreshServers: () => {
            this.props.discoverServers();
        },
        onChangeServerOption: (option) => {
            const find = this.props.servers.find(v => v.name === option.name && v.address === option.address);
            if (find) {
                this.actions.setServer(find);
                this.setState({
                    server: find
                });
                this.props.updateServer(find);
            }
        },
        setServer: (server) => {
            this.props.setServer(server);
        },
        openServer: () => {
            this.props.openServer((err, data, text) => {
                if (err) {
                    this.actions.showWifiError(err, text);
                }
            });
        },
        closeServer: () => {
            const workflowStatus = this.props.workflowStatus;
            if (includes([WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING], workflowStatus)) {
                this.setState({
                    showConnectionMessage: true,
                    connectionMessage: {
                        text: i18n._('The machine is working, disconnect will stop current print.'),
                        title: i18n._('Disconnection'),
                        img: IMAGE_WIFI_WAITING,
                        showCloseButton: false,
                        onCancel: () => {
                            this.actions.hideWifiConnectionMessage();
                        },
                        onConfirm: () => {
                            this.actions.hideWifiConnectionMessage();
                            this.props.closeServer();
                        }
                    }
                });
            } else {
                this.props.closeServer();
            }
        },
        hideWifiConnectionMessage: () => {
            this.setState({
                showConnectionMessage: false
            });
        },
        showWifiConnecting: () => {
            this.setState({
                showConnectionMessage: true,
                connectionMessage: {
                    text: i18n._('Please tap Yes on Snapmaker touchscreen to confirm Wi-Fi connection.'),
                    title: i18n._('Screen Authorization Needed'),
                    img: IMAGE_WIFI_CONNECTING,
                    showCloseButton: true,
                    onCancel: null,
                    onConfirm: null
                }
            });
        },
        showWifiConnected: () => {
            this.setState({
                showConnectionMessage: true,
                connectionMessage: {
                    text: i18n._(''),
                    title: i18n._('Connected'),
                    img: IMAGE_WIFI_CONNECTED,
                    showCloseButton: false,
                    onCancel: null,
                    onConfirm: null
                }
            });
            setTimeout(() => {
                this.actions.hideWifiConnectionMessage();
            }, 1000);
        },
        showWifiDisConnected: () => {
            this.setState({
                showConnectionMessage: true,
                connectionMessage: {
                    text: i18n._(''),
                    title: i18n._('Disconnected'),
                    img: IMAGE_WIFI_ERROR,
                    showCloseButton: false,
                    onCancel: null,
                    onConfirm: null
                }
            });
            setTimeout(() => {
                this.actions.hideWifiConnectionMessage();
            }, 1000);
        },
        showWifiError: (err, data) => {
            this.setState({
                showConnectionMessage: true,
                connectionMessage: {
                    text: i18n._(data || err.message),
                    title: err.status ? i18n._(`Error ${err.status}`) : i18n._('Error'),
                    img: IMAGE_WIFI_ERROR,
                    showCloseButton: true,
                    onCancel: null,
                    onConfirm: null
                }
            });
        },
        onCloseWifiConnectionMessage: () => {
            this.actions.hideWifiConnectionMessage();
            this.props.closeServer();
        },
        /**
         * Show manual Wi-Fi modal
         */
        showManualWiFi: () => {
            this.setState({
                showManualWiFi: true,
                manualWiFi: {
                    text: null,
                    title: i18n._('Connect Manually'),
                    label: i18n._('IP') ? `${i18n._('IP')}:` : '',
                    img: IMAGE_WIFI_WAITING,
                    showCloseButton: true,
                    inputtext: this.props.manualIp,
                    onCancel: this.actions.onCloseManualWiFi,
                    onConfirm: (text) => {
                        this.actions.onCloseManualWiFi();
                        const server = new Server('Manual', text);
                        this.props.updateManualIp(text);
                        this.props.setServer(server);
                        this.props.openServer();
                    }
                }
            });
        },
        /**
         * Hide manual Wi-Fi modal
         */
        onCloseManualWiFi: () => {
            this.setState({
                showManualWiFi: false
            });
        }
    };

    componentDidMount() {
        // Discover servers when mounted
        setTimeout(() => this.props.discoverServers());
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.connectionType === CONNECTION_TYPE_WIFI) {
            if (this.props.connectionStatus !== CONNECTION_STATUS_CONNECTING && nextProps.connectionStatus === CONNECTION_STATUS_CONNECTING) {
                this.actions.showWifiConnecting();
            }
            if (this.props.connectionStatus !== CONNECTION_STATUS_CONNECTED && nextProps.connectionStatus === CONNECTION_STATUS_CONNECTED) {
                this.actions.showWifiConnected();
            }
            if (this.props.connectionStatus !== CONNECTION_STATUS_IDLE && nextProps.connectionStatus === CONNECTION_STATUS_IDLE) {
                this.actions.showWifiDisConnected();
            }
        }
    }

    /**
     * Find server object in `servers` that matches `this.props.server`, and set it
     * as `this.state.server`. If no matches found, set the first object as server.
     * `this.state.server` is used to be displayed in in dropdown menu.
     *
     * @param servers list of server objects
     */
    autoSetServer(servers) {
        const { server } = this.props;

        const find = servers.find(v => v.name === server.name && v.address === server.address);
        if (find) {
            this.setState({
                server: find
            });
            this.props.setServer(find);
        }

        // Default select first server
        if (!find && servers.length) {
            this.setState({
                server: servers[0]
            });
            this.props.setServer(servers[0]);
        }
    }

    renderServerOptions = (server) => {
        const display = `${server.name} (${server.address})`;
        return (
            <div title={display} style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                <i>{display}</i>
            </div>
        );
    };

    /**
     *
     * @param server
     * @returns {*}
     */
    renderServerValue = (server) => {
        let display = '';
        if (server !== ABSENT_OBJECT) {
            display = `${server.name} (${server.address})`;
        }
        return (
            <div title={display} style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                <i>{display}</i>
            </div>
        );
    };

    render() {
        const { headType, servers, workflowStatus, discovering, isConnected, isOpen } = this.props;
        const { server, showConnectionMessage, connectionMessage, showManualWiFi, manualWiFi } = this.state;
        return (
            <div>
                <InputGroup className="mb-3">
                    <div
                        style={{
                            flex: '1 1 0%',
                            width: '100%',
                            marginRight: '5px'
                        }}
                    >
                        <Select
                            menuStyle={{
                                maxHeight: '100px'
                            }}
                            backspaceRemoves={false}
                            clearable={false}
                            searchable={false}
                            name="port"
                            noResultsText={i18n._('No machines detected.')}
                            onChange={this.actions.onChangeServerOption}
                            optionRenderer={this.renderServerOptions}
                            disabled={isOpen}
                            options={map(servers, (s) => ({
                                name: s.name,
                                address: s.address
                            }))}
                            placeholder={i18n._('Choose a machine')}
                            value={server}
                            valueRenderer={this.renderServerValue}
                        />
                    </div>
                    <InputGroup.Append>
                        <Button
                            variant="outline-secondary"
                            style={{ borderColor: '#c8c8c8' }}
                            name="btn-refresh"
                            title={i18n._('Refresh')}
                            disabled={isOpen}
                            onClick={this.actions.onRefreshServers}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    'fa-refresh',
                                    { 'fa-spin': discovering }
                                )}
                            />
                        </Button>
                    </InputGroup.Append>
                    <InputGroup.Append>
                        <Button
                            variant="outline-secondary"
                            style={{ borderColor: '#c8c8c8' }}
                            name="btn-add"
                            title={i18n._('Add')}
                            disabled={isOpen}
                            onClick={this.actions.showManualWiFi}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    'fa-plus'
                                )}
                            />
                        </Button>
                    </InputGroup.Append>
                </InputGroup>
                {isConnected && (
                    <div style={{ marginBottom: '10px' }}>
                        <div
                            className={styles['connection-state']}
                        >
                            <span className={styles['connection-state-name']}>
                                {server.name}
                            </span>
                            <span className={styles['connection-state-icon']}>
                                {workflowStatus === WORKFLOW_STATUS_UNKNOWN
                                && <i className="sm-icon-14 sm-icon-idle" />}
                                {workflowStatus === WORKFLOW_STATUS_IDLE
                                && <i className="sm-icon-14 sm-icon-idle" />}
                                {workflowStatus === WORKFLOW_STATUS_PAUSED
                                && <i className="sm-icon-14 sm-icon-paused" />}
                                {workflowStatus === WORKFLOW_STATUS_RUNNING
                                && <i className="sm-icon-14 sm-icon-running" />}
                            </span>
                        </div>
                        <div
                            className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])}
                            style={{
                                marginTop: '10px'
                            }}
                        />
                        {headType === MACHINE_HEAD_TYPE['3DP'].value && <PrintingState headType={headType} />}
                        {headType === MACHINE_HEAD_TYPE.LASER.value && <LaserState headType={headType} />}
                    </div>
                )}
                <div>
                    <div
                        className="btn-group"
                        style={{
                            width: '50%'
                        }}
                    >
                        {!isConnected && (
                            <button
                                type="button"
                                className="sm-btn-small sm-btn-primary"
                                onClick={this.actions.openServer}
                                disabled={isOpen}
                            >
                                <i className="fa fa-toggle-off" />
                                <span className="space" />
                                {i18n._('Connect')}
                            </button>
                        )}
                        {isConnected && (
                            <button
                                type="button"
                                className="sm-btn-small sm-btn-danger"
                                onClick={this.actions.closeServer}
                            >
                                <i className="fa fa-toggle-on" />
                                <Space width={4} />
                                {i18n._('Disconnect')}
                            </button>
                        )}
                    </div>
                </div>
                {showConnectionMessage && (
                    <ModalSmall
                        showCloseButton={connectionMessage.showCloseButton}
                        img={connectionMessage.img}
                        text={connectionMessage.text}
                        title={connectionMessage.title}
                        onClose={this.actions.onCloseWifiConnectionMessage}
                        onCancel={connectionMessage.onCancel}
                        onConfirm={connectionMessage.onConfirm}
                    />
                )
                }
                {showManualWiFi && (
                    <ModalSmallInput
                        showCloseButton={manualWiFi.showCloseButton}
                        img={manualWiFi.img}
                        text={manualWiFi.text}
                        title={manualWiFi.title}
                        label={manualWiFi.label}
                        inputtext={manualWiFi.inputtext}
                        onClose={this.actions.onCloseManualWiFi}
                        onCancel={manualWiFi.onCancel}
                        onConfirm={manualWiFi.onConfirm}
                    />
                )
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { headType, servers, discovering, server, workflowStatus, isOpen, isConnected, connectionStatus, connectionType, manualIp } = machine;

    return {
        headType,
        manualIp,
        servers,
        discovering,
        server,
        workflowStatus,
        isOpen,
        isConnected,
        connectionStatus,
        connectionType
    };
};

const mapDispatchToProps = (dispatch) => ({
    discoverServers: () => dispatch(machineActions.discoverServers()),
    openServer: (callback) => dispatch(machineActions.openServer(callback)),
    closeServer: (state) => dispatch(machineActions.closeServer(state)),
    setServer: (server) => dispatch(machineActions.setServer(server)),
    updateServer: (server) => dispatch(machineActions.updateServer(server)),
    updateManualIp: (server) => dispatch(machineActions.updateManualIp(server))
});

export default connect(mapStateToProps, mapDispatchToProps)(WifiConnection);
