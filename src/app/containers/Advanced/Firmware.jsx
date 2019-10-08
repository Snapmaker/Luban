import PropTypes from 'prop-types';
import Select from 'react-select';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import i18n from '../../lib/i18n';
import styles from './index.styl';
import modal from '../../lib/modal';
import Space from '../../components/Space';

class Calibration extends PureComponent {
    static propTypes = {
        updateFile: PropTypes.string,
        updateProgress: PropTypes.number,
        updateCount: PropTypes.number,
        firmwareVersion: PropTypes.string,
        moduleID: PropTypes.string,
        moduleVersion: PropTypes.string,
        onChangeUpdateFile: PropTypes.func,
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
        originFileUpdateType: 'MasterControl'
    };

    componentWillReceiveProps(nextProps) {
        // show warning when open CNC tab for the first time
        const { updateProgress, updateCount } = nextProps;
        console.log(this.state.shouldShowUpdateWarning, updateProgress / updateCount);
        if (this.state.shouldShowUpdateWarning && this.actions.shouldShowUpdateWarningTag && updateProgress / updateCount === 1) {
            // if (updateProgress / updateCount === 1) {
            modal({
                title: i18n._('Warning'),
                body: (
                    <div>
                        更新成功
                        <Space width={4} />
                            更新固件后，协议自动跳转为文本协议，需要重新切换协议
                        <Space width={4} />
                        <br />
                        更新固件后，协议自动跳转为文本协议，需要重新切换协议
                    </div>
                ),
                footer: (
                    <div style={{ display: 'inline-block', marginRight: '8px' }}>
                        <input
                            type="checkbox"
                            defaultChecked={false}
                            onChange={this.actions.onChangeShouldShowWarningTag}
                        />
                        <span style={{ paddingLeft: '4px' }}>下次更新不再显示</span>
                    </div>
                )
            });
            this.setState({
                shouldShowUpdateWarning: false
            });
        }
    }

    render() {
        const { updateFile, updateProgress, updateCount, moduleID, moduleVersion, firmwareVersion } = this.props;
        const hasUpdateFile = !isEmpty(updateFile);
        const state = this.state;
        const originFileUpdateType = state.originFileUpdateType;
        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('Update Firmware')}</p>
                <table style={{ width: '100%', marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td style={{ paddingLeft: '0px', width: '60%' }}>
                                <Select
                                    clearable={false}
                                    options={[{
                                        value: 'MasterControl',
                                        label: '主控'
                                    }, {
                                        value: 'Module',
                                        label: '模块'
                                    }]}
                                    value={state.originFileUpdateType}
                                    searchable={false}
                                    onChange={this.actions.onChangeUpdateType}
                                />
                            </td>
                            <td style={{ paddingRight: '0px', width: '40%' }}>
                                <button
                                    type="button"
                                    className="sm-btn-large sm-btn-default"
                                    style={{ width: '100%' }}
                                    disabled={!hasUpdateFile}
                                    onClick={() => {
                                        this.actions.updateOriginFile('start update origin file', { originFileUpdateType });
                                    }}
                                >
                                    Update Origin File
                                </button>
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
                    {i18n._('Open')}
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
                    onClick={() => {
                        this.props.executeGcode('query firmware version');
                        this.props.executeGcode('query module version');
                    }}
                >
                    Version
                </button>
                <p style={{ margin: '0' }}>updateFileName:{hasUpdateFile && updateFile}</p>
                <p style={{ margin: '0' }}>firmwareVersion:{firmwareVersion}</p>
                <p style={{ margin: '0' }}>moduleID:{moduleID}</p>
                <p style={{ margin: '0' }}>moduleVersion:{moduleVersion}</p>
                {hasUpdateFile && (
                    <p style={{ margin: '0' }}>{`${updateProgress}/${updateCount}`}</p>
                )}
            </div>
        );
    }
}

export default Calibration;
