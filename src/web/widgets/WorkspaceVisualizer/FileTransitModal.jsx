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
        devices: PropTypes.array.isRequired,
        discoverHTTPServers: PropTypes.func.isRequired
    };

    state = {
        devices: this.props.devices,
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
        if (this.state.devices.length === 0) {
            this.props.discoverHTTPServers();
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
        // Devices changed
        if (this.checkIfDevicesChanged(nextProps.devices)) {
            const devices = [];

            for (const device of nextProps.devices) {
                const d = this.findDevice(device);

                if (d) {
                    devices.push(d);
                } else {
                    // Device with default state
                    device.selected = false;
                    devices.push(device);
                }
            }

            this.setState({ devices });
        }
    }

    refreshStatus() {
        for (const device of this.state.devices) {
            if (device.name.startsWith('My')) {
                // FIXME: For KS Shooting
                setTimeout(() => {
                    device.status = 'RUNNING';
                    if (this.isComponentMounted) {
                        this.setState(state => ({
                            devices: state.devices.slice()
                        }));
                    }
                }, 300);
                continue;
            }
            device.requestStatus((err, res) => {
                if (!err) {
                    device.status = res.body.status;

                    if (this.isComponentMounted) {
                        this.setState(state => ({
                            devices: state.devices.slice()
                        }));
                    }
                }
            });
        }
    }

    findDevice(device) {
        for (const d of this.state.devices) {
            if (device.address === d.address && device.name === d.name) {
                return d;
            }
        }
        return null;
    }

    checkIfDevicesChanged(devices) {
        if (devices.length !== this.state.devices.length) {
            return true;
        }

        for (const device of devices) {
            if (!this.findDevice(device)) {
                return true;
            }
        }

        return false;
    }

    onToggleDevice(row) {
        const device = this.findDevice(row);
        if (!device) {
            return;
        }

        device.selected = !device.selected;
        this.setState(state => ({
            devices: state.devices.slice(0)
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
        for (const device of this.state.devices) {
            if (device.selected) {
                device.uploadFile(filename, file, callback);
            }
        }
    }

    render() {
        const { onClose } = this.props;
        const fileName = getGcodeName(this.props.gcodeList);
        const isSelected = this.state.devices.some(device => device.selected);

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
                                    onClick={this.props.discoverHTTPServers}
                                />
                            </div>
                        </div>
                        {this.state.devices.length === 0 &&
                        <p style={{ textAlign: 'center', height: '120px', lineHeight: '120px' }}>{i18n._('No device detected.')}</p>
                        }
                        {this.state.devices.length > 0 &&
                        (
                            <ul className={styles['file-transit-modal-list']}>
                                {
                                    this.state.devices.map(device => {
                                        let statusIconStyle = '';
                                        if (device.status === 'IDLE') {
                                            statusIconStyle = styles['icon-idle'];
                                        } else if (device.status === 'RUNNING') {
                                            statusIconStyle = styles['icon-running'];
                                        } else if (device.status === 'PAUSED') {
                                            statusIconStyle = styles['icon-paused'];
                                        } else {
                                            statusIconStyle = styles['icon-loading'];
                                        }
                                        return (
                                            <li key={device.address}>
                                                <button
                                                    type="button"
                                                    style={{ backgroundColor: 'transparent', border: 'none', width: '48px' }}
                                                    onClick={() => this.onToggleDevice(device)}
                                                >
                                                    <i className={classNames(styles.icon, device.selected ? styles['icon-checked'] : styles['icon-unchecked'])} />
                                                </button>
                                                <span className={styles['file-transit-modal-list__machine']}>
                                                    <p>{device.name}</p>
                                                    <p>{device.model}</p>
                                                </span>
                                                <span className={styles['file-transit-modal-list__address']}>{device.address}</span>
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
                        {this.state.devices.length > 0 &&
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
    devices: state.machine.devices
});

const mapDispatchToProps = (dispatch) => ({
    discoverHTTPServers: () => dispatch(machineActions.discoverHTTPServers())
});


export default connect(mapStateToProps, mapDispatchToProps)(FileTransitModal);
