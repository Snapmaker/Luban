import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { LASER_GCODE_SUFFIX } from '../../constants';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        isGcodeGenerated: PropTypes.bool.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeBeans: PropTypes.array.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const { gcodeBeans } = this.props;
            if (gcodeBeans.length === 0) {
                return;
            }
            if (gcodeBeans.length === 1) {
                const fileName = 'laser.gcode';
                const { gcode, modelInfo } = gcodeBeans[0];
                const renderMethod = (modelInfo.processMode === 'greyscale' ? 'point' : 'line');
                pubsub.publish(
                    'gcode:upload',
                    {
                        gcode: gcode,
                        meta: {
                            renderMethod: renderMethod,
                            name: fileName
                        }
                    }
                );
            } else {
                const fileName = 'laserMultiModels.gcode';
                const gcodeArr = [];
                const renderMethodArr = [];
                for (let i = 0; i < gcodeBeans.length; i++) {
                    const { gcode, modelInfo } = gcodeBeans[i];
                    const renderMethod = (modelInfo.processMode === 'greyscale' ? 'point' : 'line');
                    gcodeArr.push(gcode);
                    renderMethodArr.push(renderMethod);
                }
                pubsub.publish(
                    'gcodeArr:upload',
                    {
                        gcodeArr: gcodeArr,
                        meta: {
                            renderMethodArr: renderMethodArr,
                            name: fileName
                        }
                    }
                );
            }
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
        },
        onExport: () => {
            const { gcodeBeans } = this.props;
            if (gcodeBeans.length === 0) {
                return;
            }

            const gcodeArr = [];
            for (let i = 0; i < gcodeBeans.length; i++) {
                const { gcode } = gcodeBeans[i];
                gcodeArr.push(gcode);
            }
            const gcodeStr = gcodeArr.join('\n');
            const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
            const fileName = `laser${LASER_GCODE_SUFFIX}`;
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    render() {
        const { workState, isGcodeGenerated } = this.props;
        const disabled = (workState === 'running' || !isGcodeGenerated);

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onLoadGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onExport}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    return {
        isGcodeGenerated: laser.isGcodeGenerated,
        workState: laser.workState,
        gcodeBeans: laser.gcodeBeans
    };
};

export default connect(mapStateToProps)(Output);
