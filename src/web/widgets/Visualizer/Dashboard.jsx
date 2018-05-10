import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { ProgressBar } from 'react-bootstrap';
import Anchor from '../../components/Anchor';
import Panel from '../../components/Panel';
import i18n from '../../lib/i18n';
import { formatBytes } from '../../lib/numeral';
import styles from './dashboard.styl';

class Dashboard extends PureComponent {
    static propTypes = {
        show: PropTypes.bool,
        state: PropTypes.object
    };

    lines = [];

    render() {
        const { show, state } = this.props;
        const style = {
            display: show ? 'block' : 'none'
        };
        const downloadUrl = `api/gcode/download?port=${state.port}`;
        const filename = state.gcode.name || 'noname.nc';
        const filesize = state.gcode.ready ? formatBytes(state.gcode.size, 0) : '';
        const { sent = 0, total = 0 } = state.gcode;
        // const rowHeight = 20;

        return (
            <Panel
                className={classNames(styles.dashboard)}
                style={style}
            >
                <Panel.Heading>
                    {i18n._('G-code')}
                </Panel.Heading>
                <Panel.Body>
                    <div className="clearfix" style={{ marginBottom: 10 }}>
                        <div className="pull-left text-nowrap">
                            {state.gcode.ready &&
                            <Anchor href={downloadUrl}>
                                <strong>{filename}</strong>
                            </Anchor>
                            }
                            {!state.gcode.ready && i18n._('G-code not loaded')}
                        </div>
                        <div className="pull-right text-nowrap">
                            {filesize}
                        </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <ProgressBar
                            style={{ marginBottom: 0 }}
                            bsStyle="info"
                            min={0}
                            max={total}
                            now={sent}
                            label={total > 0 &&
                                <span className={styles.progressbarLabel}>
                                    {sent}&nbsp;/&nbsp;{total}
                                </span>
                            }
                        />
                    </div>
                    <div
                        className={classNames(
                            styles.gcodeViewer,
                            { [styles.gcodeViewerDisabled]: this.lines.length === 0 }
                        )}
                    >
                        <div className={styles.absoluteCenter}>
                            <img src="images/snap-logo-square-256x256.png" role="presentation" alt="presentation" />
                        </div>
                    </div>
                </Panel.Body>
            </Panel>
        );
    }
}

export default Dashboard;
