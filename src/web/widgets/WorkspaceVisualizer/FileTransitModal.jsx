import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import request from 'superagent';

import Modal from '../../components/Modal';
import Table from '../../components/Table';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import { actions } from '../../reducers/modules/machine';
import styles from './index.styl';
import { WEB_CACHE_IMAGE } from '../../constants';


class FileTransitModal extends PureComponent {
    static propTypes = {
        onClose: PropTypes.func.isRequired,
        gcodeName: PropTypes.string.isRequired,
        devices: PropTypes.array.isRequired,
        discoverSnapmaker: PropTypes.func.isRequired
    };

    state = {
        devices: this.props.devices
    };

    constructor(props) {
        super(props);

        this.refreshDevices = this.refreshDevices.bind(this);
        this.sendFile = this.sendFile.bind(this);
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
                    devices.push({
                        ...device,
                        selected: false
                    });
                }
            }

            this.setState({ devices });
        }
    }

    componentDidMount() {
        if (this.state.devices.length === 0) {
            this.refreshDevices();
        }
    }

    refreshDevices() {
        this.props.discoverSnapmaker();
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
        // FIXME:
        const filePath = `${WEB_CACHE_IMAGE}/${this.props.gcodeName}`;

        for (const device of this.state.devices) {
            if (device.selected) {
                const api = `http://${device.address}:8080/api/upload`;

                request
                    .post(api)
                    .attach(this.props.gcodeName, filePath)
                    .end((err, res) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log(res.body);
                        }
                    });
            }
        }
    }

    render() {
        const { gcodeName, onClose } = this.props;

        return (
            <Modal style={{ width: '600px' }} size="lg" onClose={onClose}>
                <Modal.Body>
                    <div className={styles['file-transit-modal']}>
                        <h1>{i18n._('File Transit')}</h1>
                        <div style={{ marginBottom: '10px' }}>
                            {i18n._('File Name: ')}
                            {gcodeName}
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
                                }
                            ]}
                            data={this.state.devices}
                        />
                        <div className={styles['file-transit-modal__buttons']}>
                            <button
                                type="button"
                                style={{ margin: '5px' }}
                                className={classNames(styles['btn-small'], styles['btn-default'])}
                                onClick={onClose}
                            >
                                {i18n._('Cancel')}
                            </button>
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
    discoverSnapmaker: () => dispatch(actions.discoverSnapmaker())
});


export default connect(mapStateToProps, mapDispatchToProps)(FileTransitModal);
