import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import { map } from 'lodash';

import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../reducers/machine';
import Space from '../../components/Space';


class WifiConnection extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired,
        servers: PropTypes.array.isRequired,
        discovering: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,
        serverStatus: PropTypes.string.isRequired,
        discoverServers: PropTypes.func.isRequired,
        setServer: PropTypes.func.isRequired,
        unsetServer: PropTypes.func.isRequired
    };

    actions = {
        onRefreshServers: () => {
            this.props.discoverServers();
        },
        onChangeServerOption: (option) => {
            for (const server of this.props.servers) {
                if (server.name === option.name && server.address === option.address) {
                    this.props.setServer(server);
                    break;
                }
            }
        }
    };

    componentDidMount() {
        setTimeout(() => this.props.discoverServers());
    }

    componentWillReceiveProps(nextProps) {
        // Simply compare 2 arrays
        if (nextProps.servers !== this.props.servers) {
            const { config } = this.props;

            const name = config.get('server.name');
            const address = config.get('server.address');

            // Found recently used server
            let found = false;
            for (const server of nextProps.servers) {
                if (server.name === name && server.address === address) {
                    found = true;
                    this.props.setServer(server);
                    break;
                }
            }

            // Default select first server
            if (!found && nextProps.servers.length) {
                this.props.setServer(nextProps.servers[0]);
            }
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.server && this.props.server !== prevProps.server) {
            const { config, server } = this.props;
            config.set('server.name', server.name);
            config.set('server.address', server.address);
        }
    }

    componentWillUnmount() {
        this.props.unsetServer();
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
        const { servers, server, serverStatus, discovering } = this.props;

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

    const { servers, discovering, server, serverStatus } = machine;

    return {
        servers,
        discovering,
        server,
        serverStatus
    };
};

const mapDispatchToProps = (dispatch) => ({
    discoverServers: () => dispatch(machineActions.discoverServers()),
    setServer: (server) => dispatch(machineActions.setServer(server)),
    unsetServer: (server) => dispatch(machineActions.unsetServer(server))
});

export default connect(mapStateToProps, mapDispatchToProps)(WifiConnection);
