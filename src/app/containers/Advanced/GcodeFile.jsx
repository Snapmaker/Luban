import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class GcodeFile extends PureComponent {
    static propTypes = {
        gcodeFile: PropTypes.string,
        onChangeGcodeFile: PropTypes.func,
        executeGcode: PropTypes.func
    };

    gcodeFileRef = React.createRef();

    actions = {
        clickUploadGcodeFile: () => {
            this.gcodeFileRef.current.value = null;
            this.gcodeFileRef.current.click();
        }
    };

    render() {
        const { gcodeFile } = this.props;
        return (
            <div>
                <p style={{ margin: '0' }}>{i18n._('G-Code File')}</p>
                <input
                    ref={this.gcodeFileRef}
                    type="file"
                    accept=".gcode, .nc, .cnc"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={this.props.onChangeGcodeFile}
                />
                <button
                    className={styles['btn-func']}
                    type="button"
                    onClick={() => {
                        this.actions.clickUploadGcodeFile();
                    }}
                >
                    {i18n._('Open')}
                </button>
                <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start print file')}>Start</button>
                <p style={{ margin: '0' }}>{gcodeFile}</p>
            </div>
        );
    }
}

export default GcodeFile;
