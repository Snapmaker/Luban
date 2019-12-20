import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import { map } from 'lodash';

import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import Space from '../../components/Space';
import {
    ABSENT_OBJECT,
    MACHINE_HEAD_TYPE,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN
} from '../../constants';
import MachineSelection from './MachineSelection';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import PrintingState from './PrintingState';
import LaserState from './LaserState';
import CNCState from './CNCState';


class WifiConnection extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        servers: PropTypes.array.isRequired,
        discovering: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        isOpen: PropTypes.bool.isRequired,
        isConnected: PropTypes.bool.isRequired,

        discoverServers: PropTypes.func.isRequired,
        openServer: PropTypes.func.isRequired,
        closeServer: PropTypes.func.isRequired,
        setServer: PropTypes.func.isRequired
    };

    state = {
        server: {},
        showMachineSelected: false
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
            }
        },
        openModal: () => {
            this.setState({
                showMachineSelected: true
            });
        },
        closeModal: () => {
            this.setState({
                showMachineSelected: false
            });
        },
        setServer: (server) => {
            this.props.setServer(server);
        },
        openServer: () => {
            this.props.openServer();
        },
        closeServer: () => {
            this.props.closeServer();
        }
    };

    componentDidMount() {
        setTimeout(() => this.props.discoverServers());

        // Auto set server when first launch
        if (this.props.server === ABSENT_OBJECT && this.props.servers.length) {
            this.autoSetServer(this.props.servers);
        }
    }

    componentWillReceiveProps(nextProps) {
        // Simply compare 2 arrays
        if (nextProps.servers !== this.props.servers) {
            this.autoSetServer(nextProps.servers);
        }
    }

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
        return (
            <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                <i>{server.name} ({server.address})</i>
            </div>
        );
    };

    renderServerValue = (server) => {
        return (
            <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                <i>{server.name} ({server.address})</i>
            </div>
        );
    };

    render() {
        const { headType, servers, workflowStatus, discovering, isConnected, isOpen } = this.props;
        const { server } = this.state;
        return (
            <div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                    <div className="input-group input-group-sm">
                        <Select
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
                        <div className="input-group-btn">
                            <button
                                type="button"
                                className="btn btn-default"
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
                            </button>
                        </div>
                    </div>
                </div>
                {isConnected && (
                    <div style={{
                        marginBottom: '10px'
                    }}
                    >
                        <div
                            className={styles['connection-state']}
                        >
                            <span className={styles['connection-state-name']}>
                                {server.name}
                            </span>
                            <span className={styles['connection-state-icon']}>
                                {workflowStatus === WORKFLOW_STATUS_UNKNOWN && <i className="sm-icon-14 sm-icon-idle" />}
                                {workflowStatus === WORKFLOW_STATUS_IDLE && <i className="sm-icon-14 sm-icon-idle" />}
                                {workflowStatus === WORKFLOW_STATUS_PAUSED && <i className="sm-icon-14 sm-icon-paused" />}
                                {workflowStatus === WORKFLOW_STATUS_RUNNING && <i className="sm-icon-14 sm-icon-running" />}
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
                        {headType === MACHINE_HEAD_TYPE.CNC.value && <CNCState headType={headType} />}
                    </div>
                )}
                <div>
                    <div
                        className="btn-group btn-group-sm"
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
                                {i18n._('Open')}
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
                                {i18n._('Close')}
                            </button>
                        )}
                    </div>
                </div>
                <MachineSelection
                    display={this.state.showMachineSelected}
                    closeModal={this.actions.closeModal}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { headType, servers, discovering, server, workflowStatus, isOpen, isConnected } = machine;

    return {
        headType,
        servers,
        discovering,
        server,
        workflowStatus,
        isOpen,
        isConnected
    };
};

const mapDispatchToProps = (dispatch) => ({
    discoverServers: () => dispatch(machineActions.discoverServers()),
    openServer: () => dispatch(machineActions.openServer()),
    closeServer: (state) => dispatch(machineActions.closeServer(state)),
    setServer: (server) => dispatch(machineActions.setServer(server))
});

export default connect(mapStateToProps, mapDispatchToProps)(WifiConnection);
