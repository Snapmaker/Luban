import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import { map } from 'lodash';

import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../reducers/machine';
import Space from '../../components/Space';


class WiFiConnection extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired,
        servers: PropTypes.array.isRequired,
        discovering: PropTypes.bool.isRequired,
        discoverHTTPServers: PropTypes.func.isRequired
    };

    state = {
        discovering: false,

        server: null,
        serverStatus: 'UNKNOWN'
    };

    statusTimer = null;

    actions = {
        onChangeServerOption: (option) => {
            for (const server of this.props.servers) {
                if (server.name === option.name && server.address === option.address) {
                    this.selectServer(server);
                    break;
                }
            }
        }
    };

    componentDidMount() {
        setTimeout(() => this.refreshServers());
    }

    componentWillReceiveProps(nextProps) {
        // Simply compare 2 arrays
        if (nextProps.servers !== this.props.servers) {
            const { config } = this.props;

            const name = config.get('server.name');
            const address = config.get('server.address');

            let found = false;
            for (const server of nextProps.servers) {
                if (server.name === name && server.address === address) {
                    found = true;
                    this.selectServer(server);
                    break;
                }
            }

            // Default select first server
            if (!found && nextProps.servers.length) {
                this.selectServer(nextProps.servers[0]);
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.server !== prevState.server) {
            const { config } = this.props;
            const { server } = this.state;
            config.set('server.name', server.name);
            config.set('server.address', server.address);
        }
    }

    componentWillUnmount() {
        if (this.statusTimer) {
            clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }
    }

    refreshServers() {
        this.props.discoverHTTPServers();
    }

    selectServer(server) {
        this.setState({
            server,
            serverStatus: 'UNKNOWN'
        });

        // Cancel previous status polling
        if (this.statusTimer) {
            clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }

        // Get status of server frequently
        if (this.statusTimer === null) { // double check
            const getStatus = () => {
                server.requestStatus((err, res) => {
                    if (!err) {
                        this.setState({ serverStatus: res.body.status });
                    }

                    this.statusTimer = setTimeout(getStatus, 1000 * 15);
                });
            };
            this.statusTimer = setTimeout(getStatus);
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
        const { servers } = this.props;
        const { server, serverStatus, discovering } = this.state;

        return (
            <div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                    <div className="input-group input-group-sm">
                        <Select
                            backspaceRemoves={false}
                            clearable={false}
                            searchable={false}
                            name="port"
                            noResultsText={i18n._('No machines available')}
                            onChange={this.actions.onChangeServerOption}
                            optionRenderer={this.renderServerOptions}
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
                                onClick={this.actions.onRefreshPorts}
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
                <div>
                    {i18n._('Status:')}
                    <Space width={4} />
                    {serverStatus}
                    <Space width={4} />
                    {serverStatus === 'IDLE' && <i className="sm-icon-14 sm-icon-idle" />}
                    {serverStatus === 'PAUSED' && <i className="sm-icon-14 sm-icon-paused" />}
                    {serverStatus === 'RUNNING' && <i className="sm-icon-14 sm-icon-running" />}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { discovering } = machine;

    return {
        servers: machine.devices,
        discovering
    };
};

const mapDispatchToProps = (dispatch) => ({
    discoverHTTPServers: () => dispatch(machineActions.discoverHTTPServers())
});

export default connect(mapStateToProps, mapDispatchToProps)(WiFiConnection);
