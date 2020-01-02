import PropTypes from 'prop-types';
import Select from 'react-select';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import TextArea from 'react-textarea-autosize';
import { screenController } from '../../lib/controller';
import api from '../../api';
import i18n from '../../lib/i18n';
import styles from './index.styl';
import modal from '../../lib/modal';
import { PROTOCOL_SCREEN } from '../../constants';

class Firmware extends PureComponent {
    static propTypes = {
        port: PropTypes.string,
        executeGcode: PropTypes.func
    };

    updateFileRef = React.createRef();

    moduleTextarea = React.createRef();

    actions = {
        onChangeUpdateFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.actions.uploadUpdateFile(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload file'),
                    body: e.message
                });
            }
        },
        uploadUpdateFile: async (file) => {
            const formData = new FormData();
            const { port } = this.props;
            formData.append('file', file);
            formData.append('port', port);
            formData.append('dataSource', PROTOCOL_SCREEN);
            const res = await api.uploadUpdateFile(formData);
            const { originalName } = res.body;
            this.setState({
                updateFile: originalName
            });
        },
        clickUploadUpdateFile: () => {
            this.updateFileRef.current.value = null;
            this.updateFileRef.current.click();
            this.setState({ shouldShowUpdateWarning: true });
        },
        onChangeUpdateType: (option) => {
            this.setState({
                originFileUpdateType: option.value
            });
        },
        onChangeShouldShowWarningTag: () => {
            this.setState({
                shouldShowUpdateWarningTag: false
            });
        },
        updateOriginFile: (command, fileTpye) => {
            this.props.executeGcode(command, fileTpye);
            if (this.state.shouldShowUpdateWarningTag) {
                this.setState({
                    shouldShowUpdateWarning: true
                });
            }
        },
        updatePacketFile: (command) => {
            this.props.executeGcode(command);
            if (this.state.shouldShowUpdateWarningTag) {
                this.setState({
                    shouldShowUpdateWarning: true
                });
            }
        },
        queryUpdateVersion: () => {
            this.state.moduleIDs.splice(0);
            this.props.executeGcode('query firmware version');
            this.props.executeGcode('query module version');
            this.moduleTextarea.value = '';
        }
    };

    state = {
        updateFile: '',
        updateProgress: 0,
        updateCount: 0,
        firmwareVersion: '',
        moduleIDs: [],
        shouldShowUpdateWarning: false,
        shouldShowUpdateWarningTag: true,
        originFileUpdateType: 'MainControl'
    };

    controllerEvents = {
        // 'Marlin:state': (state, dataSource) => {
        'Marlin:state': (options) => {
            const { state, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            const { moduleID, moduleVersion, updateProgress, updateCount, firmwareVersion } = state;
            if (updateProgress !== this.state.updateProgress) {
                this.setState({
                    updateProgress
                });
            }
            if (updateCount !== this.state.updateCount) {
                this.setState({
                    updateCount
                });
            }
            if (firmwareVersion !== this.state.firmwareVersion) {
                this.setState({
                    firmwareVersion
                });
            }
            if (moduleID && (this.state.moduleIDs.indexOf(moduleID) === -1)) {
                const moduleIDs = [...this.state.moduleIDs];
                moduleIDs.push(moduleID);
                this.setState({ moduleIDs: moduleIDs });
                this.moduleTextarea.value += `${moduleID}: ${moduleVersion}\n`;
            }
            if (this.state.shouldShowUpdateWarning && this.state.shouldShowUpdateWarningTag && updateCount > 0 && (updateProgress === updateCount)) {
                modal({
                    title: i18n._('Update Finished'),
                    body: (
                        <div>
                            {i18n._('The firmware is updated successfully. The calibration data will be reset. For the module update, it may take about one minute to restart the machine. Please wait until the machine is restarted. ')}
                        </div>
                    )
                });
                if (typeof this.props.executeGcode === 'function') {
                    setTimeout(() => {
                        screenController.command('force switch');
                    }, 8000);
                }
                this.setState({
                    shouldShowUpdateWarning: false
                });
            }
        }
    };

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.off(eventName, callback);
        });
    }

    render() {
        const { updateFile, updateProgress, updateCount, firmwareVersion, originFileUpdateType } = this.state;
        const hasUpdateFile = !isEmpty(updateFile);
        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('Update Firmware')}</p>
                <table style={{ width: '60%', marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ paddingLeft: '0px', width: '60%' }}>
                                <p style={{ margin: '0' }}>{i18n._('Packet Type for Raw Update')}:</p>
                                <Select
                                    clearable={false}
                                    options={[{
                                        value: 'MainControl',
                                        label: i18n._('Main Controller')
                                    }, {
                                        value: 'Module',
                                        label: i18n._('Modules')
                                    }]}
                                    value={originFileUpdateType}
                                    searchable={false}
                                    onChange={this.actions.onChangeUpdateType}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <input
                    ref={this.updateFileRef}
                    type="file"
                    accept=".bin"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.actions.onChangeUpdateFile}
                />
                <button
                    className={styles['btn-func']}
                    type="button"
                    onClick={() => {
                        this.actions.clickUploadUpdateFile();
                    }}
                >
                    {i18n._('Upload')}
                </button>
                <button
                    className={styles['btn-func']}
                    type="button"
                    disabled={!hasUpdateFile}
                    onClick={() => this.actions.updatePacketFile('start update')}
                >
                    {i18n._('Update')}
                </button>
                <button
                    className={styles['btn-func']}
                    type="button"
                    disabled={!hasUpdateFile}
                    onClick={() => {
                        this.actions.updateOriginFile('start update origin file', { originFileUpdateType });
                    }}
                >
                    {i18n._('Raw Update')}
                </button>
                <button
                    className={styles['btn-func']}
                    type="button"
                    onClick={() => { this.actions.queryUpdateVersion(); }}
                >
                    {i18n._('Version')}
                </button>
                <p style={{ margin: '0' }}>{i18n._('Update Filename')}:{hasUpdateFile && updateFile}</p>
                <p style={{ margin: '0' }}>{i18n._('Firmware Version')}:{firmwareVersion}</p>
                <TextArea
                    style={{ width: '60%' }}
                    minRows={5}
                    maxRows={7}
                    placeholder="Firmware Module ID"
                    inputRef={(tag) => {
                        this.moduleTextarea = tag;
                    }}
                />
                {hasUpdateFile && (
                    <p style={{ margin: '0' }}>{`${updateProgress}/${updateCount}`}</p>
                )}
            </div>
        );
    }
}

export default Firmware;
