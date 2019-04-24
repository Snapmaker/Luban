import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import Space from '../../components/Space';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import { actions as machineActions } from '../../reducers/machine';
import { getGcodeName } from '../../reducers/workspace';
import styles from './index.styl';


class FileTransitModal extends PureComponent {
    static propTypes = {
        onClose: PropTypes.func.isRequired,
        gcodeList: PropTypes.array.isRequired,
        servers: PropTypes.array.isRequired,
        discoverServers: PropTypes.func.isRequired
    };

    state = {
        servers: this.props.servers,
        isSendingFile: false
    };

    timer = null;

    isComponentMounted = false;

    constructor(props) {
        super(props);

        this.sendFile = this.sendFile.bind(this);
    }

    componentDidMount() {
        // Discover on the start
        if (this.state.servers.length === 0) {
            this.props.discoverServers();
        }

        this.isComponentMounted = true;

        const polling = () => {
            this.refreshStatus();
            this.timer = setTimeout(polling, 2000);
        };

        polling();
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    componentWillReceiveProps(nextProps) {
        // servers changed
        if (this.checkIfServersChanged(nextProps.servers)) {
            const servers = [];

            for (const server of nextProps.servers) {
                const d = this.findServer(server);

                if (d) {
                    servers.push(d);
                } else {
                    // Server with default state
                    server.selected = false;
                    servers.push(server);
                }
            }

            this.setState({ servers });
        }
    }

    refreshStatus() {
        for (const server of this.state.servers) {
            if (server.name.startsWith('My')) {
                // FIXME: For KS Shooting
                setTimeout(() => {
                    server.status = 'RUNNING';
                    if (this.isComponentMounted) {
                        this.setState(state => ({
                            servers: state.servers.slice()
                        }));
                    }
                }, 300);
                continue;
            }
            server.requestStatus((err, res) => {
                if (!err) {
                    server.status = res.body.status;

                    if (this.isComponentMounted) {
                        this.setState(state => ({
                            servers: state.servers.slice()
                        }));
                    }
                }
            });
        }
    }

    findServer(server) {
        for (const s of this.state.servers) {
            if (server.address === s.address && server.name === s.name) {
                return s;
            }
        }
        return null;
    }

    checkIfServersChanged(servers) {
        if (servers.length !== this.state.servers.length) {
            return true;
        }

        for (const server of servers) {
            if (!this.findServer(server)) {
                return true;
            }
        }

        return false;
    }

    onToggleServer(row) {
        const server = this.findServer(row);
        if (!server) {
            return;
        }

        server.selected = !server.selected;
        this.setState(state => ({
            servers: state.servers.slice(0)
        }));
    }

    sendFile() {
        const gcode = this.props.gcodeList.map(gcodeBean => gcodeBean.gcode).join('\n');
        const filename = getGcodeName(this.props.gcodeList);

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], filename);

        let successCount = 0;
        let hasError = false;

        const callback = (err) => {
            if (err) {
                console.error(err);
                if (!hasError) {
                    hasError = true;
                    modal({
                        title: i18n._('Error'),
                        body: i18n._('Transit file failed.')
                    });
                    this.setState({ isSendingFile: false });
                }
            }
            successCount++;
            if (successCount === this.props.gcodeList.length) {
                this.setState({ isSendingFile: false });
                this.props.onClose();
            }
        };

        this.setState({ isSendingFile: true });
        for (const server of this.state.servers) {
            if (server.selected) {
                server.uploadFile(filename, file, callback);
            }
        }
    }

    render() {
        const { onClose } = this.props;
        const fileName = getGcodeName(this.props.gcodeList);
        const isSelected = this.state.servers.some(server => server.selected);

        return (
            <Modal style={{ width: '720px' }} size="lg" onClose={onClose}>
                <Modal.Body style={{ padding: '20px 36px' }}>
                    <div className={styles['file-transit-modal']}>
                        <h1 className={styles['file-transit-modal-title']}>{i18n._('File Transit')}</h1>
                        <div style={{ marginTop: '20px', marginBottom: '20px', height: '32px', lineHeight: '32px' }}>
                            <Space width={10} />
                            <i className="fa fa-file-text-o" />
                            <Space width={10} />
                            <span style={{ verticalAlign: 'middle' }}>{fileName}</span>
                            <div className={styles['file-transit-modal__refresh']}>
                                <Anchor
                                    className={classNames(styles['icon-32'], styles['icon-refresh'])}
                                    onClick={this.props.discoverServers}
                                />
                            </div>
                        </div>
                        {this.state.servers.length === 0 &&
                        <p style={{ textAlign: 'center', height: '120px', lineHeight: '120px' }}>{i18n._('No machine detected.')}</p>
                        }
                        {this.state.servers.length > 0 &&
                        (
                            <ul className={styles['file-transit-modal-list']}>
                                {
                                    this.state.servers.map(server => {
                                        let statusIconStyle = '';
                                        if (server.status === 'IDLE') {
                                            statusIconStyle = styles['icon-idle'];
                                        } else if (server.status === 'RUNNING') {
                                            statusIconStyle = styles['icon-running'];
                                        } else if (server.status === 'PAUSED') {
                                            statusIconStyle = styles['icon-paused'];
                                        } else {
                                            statusIconStyle = styles['icon-loading'];
                                        }
                                        return (
                                            <li key={server.address}>
                                                <button
                                                    type="button"
                                                    style={{ backgroundColor: 'transparent', border: 'none', width: '48px' }}
                                                    onClick={() => this.onToggleServer(server)}
                                                >
                                                    <i className={classNames(styles.icon, server.selected ? styles['icon-checked'] : styles['icon-unchecked'])} />
                                                </button>
                                                <span className={styles['file-transit-modal-list__machine']}>
                                                    <p>{server.name}</p>
                                                    <p>{server.model}</p>
                                                </span>
                                                <span className={styles['file-transit-modal-list__address']}>{server.address}</span>
                                                <span className={styles['file-transit-modal-list__status']}>
                                                    <i className={classNames(styles['icon-32'], statusIconStyle)} />
                                                </span>
                                            </li>
                                        );
                                    })
                                }
                            </ul>
                        )
                        }
                        {this.state.servers.length > 0 &&
                        (
                            <div className={styles['file-transit-modal__buttons']}>
                                <button
                                    style={{ margin: '5px' }}
                                    type="button"
                                    className="sm-btn-small sm-btn-primary"
                                    disabled={!isSelected || this.state.isSendingFile}
                                    onClick={this.sendFile}
                                >
                                    {this.state.isSendingFile ? i18n._('Sending') : i18n._('Send')}
                                </button>
                            </div>
                        )
                        }
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    servers: state.machine.servers
});

const mapDispatchToProps = (dispatch) => ({
    discoverServers: () => dispatch(machineActions.discoverServers())
});


export default connect(mapStateToProps, mapDispatchToProps)(FileTransitModal);
