import PropTypes from 'prop-types';
import Select from 'react-select';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import styles from './index.styl';
import modal from '../../lib/modal';
// import Space from '../../components/Space';

class Firmware extends PureComponent {
    static propTypes = {
        updateFile: PropTypes.string,
        updateProgress: PropTypes.number,
        updateCount: PropTypes.number,
        firmwareVersion: PropTypes.string,
        moduleIDArray: PropTypes.object,
        moduleVersion: PropTypes.string,
        onChangeUpdateFile: PropTypes.func,
        queryUpdateVersion: PropTypes.func,
        executeGcode: PropTypes.func
    };

    updateFileRef = React.createRef();

    actions = {
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
        }
    };

    state = {
        shouldShowUpdateWarning: false,
        shouldShowUpdateWarningTag: true,
        originFileUpdateType: 'MainControl'
    };

    componentWillReceiveProps(nextProps) {
        // show warning when open CNC tab for the first time
        const { updateProgress, updateCount } = nextProps;
        if (this.state.shouldShowUpdateWarning && this.state.shouldShowUpdateWarningTag && updateCount > 0 && (updateProgress === updateCount)) {
            modal({
                title: i18n._('Update Finished'),
                body: (
                    <div>
                        {i18n._('The firmware update is finished successfully, and the protocol and calibration data will be reset. Please perform calibration again since the default calibration values may not fit well. By default, M502 and M420 V will be executed in case the head may hit the heatbed.')}
                    </div>
                )
                /*
                footer: (
                    <div style={{ display: 'inline-block', marginRight: '8px' }}>
                        <input
                            type="checkbox"
                            defaultChecked={false}
                            onChange={this.actions.onChangeShouldShowWarningTag}
                        />
                        <span style={{ paddingLeft: '4px' }}>{i18n._('not show next time')}</span>
                    </div>
                )
                */
            });
            console.log('update finished', updateProgress);
            if (typeof this.props.executeGcode === 'function') {
                setTimeout(() => {
                    controller.command('force switch');
                    this.props.executeGcode('M502');
                    this.props.executeGcode('M420 V');
                }, 8000);
            }
            this.setState({
                shouldShowUpdateWarning: false
            });
            updateProgress = 0;
            updateCount = 0;
        }
    }

    render() {
        const { updateFile, updateProgress, updateCount, moduleIDArray, moduleVersion, firmwareVersion } = this.props;
        const hasUpdateFile = !isEmpty(updateFile);
        const state = this.state;
        const originFileUpdateType = state.originFileUpdateType;
        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('Update Firmware')}</p>
                <table style={{ width: '60%', marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ paddingLeft: '0px', width: '60%' }}>
                                <p style={{ margin: '0' }}>{i18n._('Pack Type for Raw Update')}:</p>
                                <Select
                                    clearable={false}
                                    options={[{
                                        value: 'MainControl',
                                        label: 'MainControl'
                                    }, {
                                        value: 'Module',
                                        label: 'Module'
                                    }]}
                                    value={state.originFileUpdateType}
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
                    onChange={this.props.onChangeUpdateFile}
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
                    {i18n._('PackUpdate')}
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
                    onClick={() => { this.props.queryUpdateVersion(); }}
                >
                    Version
                </button>
                <p style={{ margin: '0' }}>updateFileName:{hasUpdateFile && updateFile}</p>
                <p style={{ margin: '0' }}>firmwareVersion:{firmwareVersion}</p>
                <p style={{ margin: '0' }}>moduleIDArray:{moduleIDArray.join(',')}</p>
                <p style={{ margin: '0' }}>moduleVersion:{moduleVersion}</p>
                {hasUpdateFile && (
                    <p style={{ margin: '0' }}>{`${updateProgress}/${updateCount}`}</p>
                )}
            </div>
        );
    }
}

export default Firmware;
