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
        onChangeUpdateFile: PropTypes.func,
        executeGcode: PropTypes.func
    };

    updateFileRef = React.createRef();

    actions = {
        clickUploadUpdateFile: () => {
            this.updateFileRef.current.value = null;
            this.updateFileRef.current.click();
            this.setState({ shouldShowUpdateWarning: true });
            console.log(this.state.shouldShowUpdateWarning);
        },
        onChangeUpdateType: (option) => {
            this.setState({
                originFileUpdateType: option.value
            });
        },
        onChangeShouldShowWarning: () => {
            this.setState({
                shouldShowUpdateWarning: false
            });
        }
    };

    state = {
        shouldShowUpdateWarning: true,
        originFileUpdateType: 'MasterControl'
    };

    componentWillReceiveProps(nextProps) {
        // show warning when open CNC tab for the first time
        const { updateProgress, updateCount } = nextProps;
        console.log(updateProgress, updateCount);
        if (this.state.shouldShowUpdateWarning && updateProgress / updateCount === 1) {
            modal({
                title: i18n._('Warning'),
                body: (
                    <div>
                        更新成功
                        <Space width={4} />
                            更新固件后，协议自动跳转为文本协议，需要重新连接端口
                        <Space width={4} />
                        <br />
                        更新固件后，协议自动跳转为文本协议，需要重新连接端口

                    </div>
                ),
                footer: (
                    <div style={{ display: 'inline-block', marginRight: '8px' }}>
                        <input
                            type="checkbox"
                            defaultChecked={false}
                            onChange={this.actions.onChangeShouldShowWarning}
                        />
                        <span style={{ paddingLeft: '4px' }}>关闭并重连</span>
                    </div>
                )
            });
        }
    }

    render() {
        const { updateFile, updateProgress, updateCount, firmwareVersion } = this.props;
        const hasUpdateFile = !isEmpty(updateFile);
        const state = this.state;
        const originFileUpdateType = state.originFileUpdateType;
        const actions = this.actions;
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
                                    onChange={actions.onChangeUpdateType}
                                />
                            </td>
                            <td style={{ paddingRight: '0px', width: '40%' }}>
                                <button
                                    type="button"
                                    className="sm-btn-large sm-btn-default"
                                    style={{ width: '100%' }}
                                    disabled={!hasUpdateFile}
                                    onClick={() => this.props.executeGcode('start update origin file', { originFileUpdateType })}
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
                        actions.clickUploadUpdateFile();
                    }}
                >
                    {i18n._('Open')}
                </button>
                <button
                    className={styles['btn-func']}
                    type="button"
                    disabled={!hasUpdateFile}
                    onClick={() => this.props.executeGcode('start update')}
                >
                    Update
                </button>
                <button
                    className={styles['btn-func']}
                    type="button"
                    onClick={() => this.props.executeGcode('query firmware version')}
                >
                    Version
                </button>
                <p style={{ margin: '0' }}>firmwareVersion:{firmwareVersion}</p>
                <p style={{ margin: '0' }}>updateFileName:{updateFile}</p>
                {(
                    <p style={{ margin: '0' }}>{`${updateProgress}/${updateCount}`}</p>
                )}
            </div>
        );
    }
}

export default Calibration;
