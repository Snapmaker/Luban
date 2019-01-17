import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import Modal from '../../components/Modal';
import Table from '../../components/Table';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import { actions as machineActions } from '../../reducers/modules/machine';
import { getGcodeName } from '../../reducers/modules/workspace';
import styles from './index.styl';


class FileTransitModal extends PureComponent {
    static propTypes = {
        onClose: PropTypes.func.isRequired,
        gcodeList: PropTypes.array.isRequired,
        devices: PropTypes.array.isRequired,
        discoverSnapmaker: PropTypes.func.isRequired
    };

    state = {
        devices: this.props.devices
    };

    timer = null;

    constructor(props) {
        super(props);

        this.sendFile = this.sendFile.bind(this);
    }

    componentDidMount() {
        // Discover on the start
        if (this.state.devices.length === 0) {
            this.props.discoverSnapmaker();
        }

        this.timer = setInterval(() => {
            for (const device of this.props.devices) {
                device.requestStatus((err, res) => {
                    if (!err) {
                        device.status = res.body.status;
                    }
                });
            }
        }, 2000);
    }

    componentWillUnmount() {
        if (this.timer) {
            clearInterval(this.timer);
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

    onSelect(row) {
        const device = this.findDevice(row);

        if (!device) {
            return;
        }

        device.selected = !device.selected;
        this.setState({
            devices: this.state.devices.slice(0)
        });
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
                }
            }
            successCount++;
            if (successCount === this.props.gcodeList.length) {
                this.props.onClose();
            }
        };

        for (const device of this.state.devices) {
            if (device.selected) {
                device.uploadFile(filename, file, callback);
            }
        }
    }

    render() {
        const { onClose } = this.props;
        const fileName = getGcodeName(this.props.gcodeList);

        return (
            <Modal style={{ width: '600px' }} size="lg" onClose={onClose}>
                <Modal.Body>
                    <div className={styles['file-transit-modal']}>
                        <h1>{i18n._('File Transit')}</h1>
                        <div style={{ marginBottom: '10px' }}>
                            {i18n._('File Name: ')}
                            {fileName}
                            <div className={styles['file-transit-modal__refresh']}>
                                <Anchor
                                    className={classNames('fa', 'fa-refresh', styles['fa-btn'])}
                                    onClick={this.refreshDevices}
                                />
                            </div>
                        </div>
                        <Table
                            style={{ borderTop: '1px solid #ddd' }}
                            bordered={false}
                            justified={false}
                            emptyText={() => 'No devices discovered.'}
                            columns={[
                                {
                                    title: i18n._('Select'),
                                    key: 'selected',
                                    render: (text, row) => {
                                        return (
                                            <input
                                                type="checkbox"
                                                defaultChecked={row.selected}
                                                onChange={() => this.onSelect(row)}
                                            />
                                        );
                                    }
                                },
                                {
                                    title: i18n._('Name'),
                                    key: 'name',
                                    render: (text, row) => row.name
                                },
                                {
                                    title: i18n._('IP address'),
                                    key: 'ip',
                                    render: (text, row) => row.address
                                },
                                {
                                    title: i18n._('Status'),
                                    key: 'status',
                                    render: (text, row) => row.status
                                }
                            ]}
                            data={this.state.devices}
                        />
                        <div className={styles['file-transit-modal__buttons']}>
                            <button
                                style={{ margin: '5px' }}
                                type="button"
                                className={classNames(styles['btn-small'], styles['btn-primary'])}
                                onClick={this.sendFile}
                            >
                                {i18n._('Send')}
                            </button>
                        </div>
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
    discoverSnapmaker: () => dispatch(machineActions.discoverSnapmaker())
});


export default connect(mapStateToProps, mapDispatchToProps)(FileTransitModal);
