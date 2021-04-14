import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Button, InputGroup } from 'react-bootstrap';
import { map } from 'lodash';
import Select from '../../components/Select';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_WIFI,
    IMAGE_WIFI_CONNECTED,
    IMAGE_WIFI_CONNECTING,
    IMAGE_WIFI_ERROR,
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
        // discover server
        servers: PropTypes.array.isRequired,
        serverDiscovering: PropTypes.bool.isRequired,

        discoverSnapmakerServers: PropTypes.func.isRequired,

        // connection
        connectionType: PropTypes.string.isRequired,
        connectionStatus: PropTypes.string.isRequired,

        server: PropTypes.object.isRequired,
        manualIp: PropTypes.string,
        savedServerAddress: PropTypes.string.isRequired,

        setSelectedServer: PropTypes.func.isRequired,
        setManualIP: PropTypes.func.isRequired,

        // TODO
        addServer: PropTypes.func.isRequired,
        openServer: PropTypes.func.isRequired,
        closeServer: PropTypes.func.isRequired,

        // machine status
        headType: PropTypes.string,
        workflowStatus: PropTypes.string.isRequired,
        isOpen: PropTypes.bool.isRequired,
        isConnected: PropTypes.bool.isRequired
    };

    state = {
        showConnectionMessage: false,
        connectionMessage: {
            text: '',
            title: '',
            img: IMAGE_WIFI_WAITING,
            showCloseButton: false,
            onCancel: null,
            onConfirm: null
        },
        showManualWiFiModal: false,
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
            this.props.discoverSnapmakerServers();
        },
        onChangeServerOption: (option) => {
            const server = this.props.servers.find(v => v.name === option.value && v.address === option.address);
            if (server) {
                this.props.setSelectedServer(server);
                this.setState({ server });
            }
        },
        openServer: () => {
            const { server } = this.state;
            this.props.setSelectedServer(server);
            this.props.openServer((err, data, text) => {
                if (err) {
                    this.actions.showWifiError(err, text);
                }
            });
        },
        closeServer: () => {
            this.props.closeServer();
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
                    text: '',
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
        showWifiDisconnected: () => {
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
        showManualWiFiModal: () => {
            this.setState({
                showManualWiFiModal: true,
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

                        this.props.setManualIP(text);
                        const newServer = new Server('Manual', text);

                        // Try add new server
                        const server = this.props.addServer(newServer);

                        // set state server and then open it
                        this.setState({ server }, () => {
                            this.actions.openServer();
                        });
                    }
                }
            });
        },
        /**
         * Hide manual Wi-Fi modal
         */
        onCloseManualWiFi: () => {
            this.setState({
                showManualWiFiModal: false
            });
        }
    };

    componentDidMount() {
        // Discover servers on mounted
        this.props.discoverSnapmakerServers();
    }

    componentWillReceiveProps(nextProps) {
        // Simply compare 2 arrays
        if (nextProps.servers !== this.props.servers) {
            this.autoSetServer(nextProps.servers, nextProps.server);
        }

        if (nextProps.connectionType === CONNECTION_TYPE_WIFI) {
            if (this.props.connectionStatus !== CONNECTION_STATUS_CONNECTING && nextProps.connectionStatus === CONNECTION_STATUS_CONNECTING) {
                this.actions.showWifiConnecting();
            }
            if (this.props.connectionStatus !== CONNECTION_STATUS_CONNECTED && nextProps.connectionStatus === CONNECTION_STATUS_CONNECTED) {
                this.actions.showWifiConnected();
            }
            if (this.props.connectionStatus !== CONNECTION_STATUS_IDLE && nextProps.connectionStatus === CONNECTION_STATUS_IDLE) {
                this.actions.showWifiDisconnected();
            }
        }
    }

    /**
     * Find server object in `servers` that matches `this.props.server`, and set it
     * as `this.state.server`. If no matches found, set the first object as server.
     * `this.state.server` is used to be displayed in in dropdown menu.
     *
     * @param servers - list of server objects
     * @param server - selected server
     */
    autoSetServer(servers, server) {
        const { savedServerAddress } = this.props;
        let find;
        if (server !== ABSENT_OBJECT) {
            find = servers.find(v => v.name === server.name && v.address === server.address);
        } else {
            // If no server selected, we select server based on saved server address
            find = servers.find(v => v.address === savedServerAddress);
        }

        if (find) {
            this.setState({
                server: find
            });
        } else if (servers.length > 0) {
            // Default select first server
            const firstServer = servers[0];
            this.setState({
                server: firstServer
            });
        }
    }

    // renderServerOption = (props) => {
    //     const display = `${props.value} (${props.label})`;
    //     return (
    //         <components.Option {...props}>
    //             {display}
    //         </components.Option>
    //     );
    // }


    /**
     *
     * @param server
     * @returns {*}
     * not use
     */
    // renderServerInput = (props) => {
    //     let display = '';
    //     if (props.label !== ABSENT_OBJECT) {
    //         display = `${props.value} (${props.label})`;
    //     } else {
    //         display = i18n._('No machines detected.');
    //     }
    //     return (
    //         <components.Option {...props}>
    //             {display}
    //         </components.Option>
    //     );
    // };

    render() {
        const { headType, servers, workflowStatus, serverDiscovering, isConnected, isOpen } = this.props;
        const { server, showConnectionMessage, connectionMessage, showManualWiFiModal, manualWiFi } = this.state;
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
                        {/** https://react-select.com/upgrade-guide#new-components-api **/}
                        <Select
                            backspaceRemoves={false}
                            clearable={false}
                            name="port"
                            noResultsText={i18n._('No machines detected.')}
                            onChange={this.actions.onChangeServerOption}
                            disabled={isOpen}
                            options={map(servers, (s) => ({
                                value: s.name,
                                address: s.address,
                                label: `${s.name} (${s.address})`
                            }))}
                            placeholder={i18n._('Choose a machine')}
                            value={server ? server?.name : ''}
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
                                    { 'fa-spin': serverDiscovering }
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
                            onClick={this.actions.showManualWiFiModal}
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
                                {i18n._('Connect')}
                            </button>
                        )}
                        {isConnected && (
                            <button
                                type="button"
                                className="sm-btn-small sm-btn-danger"
                                onClick={this.actions.closeServer}
                            >
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
                )}
                {showManualWiFiModal && (
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
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const {
        servers,
        serverDiscovering,

        connectionType,
        connectionStatus,
        server,
        savedServerAddress,
        manualIp,
        // machine status
        headType, workflowStatus, isOpen, isConnected
    } = machine;

    return {
        servers,
        serverDiscovering,

        connectionType,
        connectionStatus,

        server,
        manualIp,
        savedServerAddress,

        // machine status
        headType,
        workflowStatus,
        isOpen,
        isConnected
    };
};

const mapDispatchToProps = (dispatch) => ({
    discoverSnapmakerServers: () => dispatch(machineActions.discover.discoverSnapmakerServers()),
    addServer: (server) => dispatch(machineActions.connect.addServer(server)),
    openServer: (callback) => dispatch(machineActions.openServer(callback)),
    closeServer: (state) => dispatch(machineActions.closeServer(state)),
    setSelectedServer: (server) => dispatch(machineActions.connect.setSelectedServer(server)),
    setManualIP: (server) => dispatch(machineActions.connect.setManualIP(server))
});

export default connect(mapStateToProps, mapDispatchToProps)(WifiConnection);
