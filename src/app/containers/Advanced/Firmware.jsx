import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import isEmpty from 'lodash/isEmpty';
import i18n from '../../lib/i18n';
import styles from './index.styl';

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
        }
    };

    render() {
        const { updateFile, updateProgress, updateCount, firmwareVersion } = this.props;
        const hasUpdateFile = !isEmpty(updateFile);
        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('Update Firmware')}</p>
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
                <p style={{ margin: '0' }}>{firmwareVersion}</p>
                <p style={{ margin: '0' }}>{updateFile}</p>
                {!!updateCount && (
                    <p style={{ margin: '0' }}>{`${updateProgress}/${updateCount}`}</p>
                )}
            </div>
        );
    }
}

export default Calibration;
