import React, { PureComponent } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import FileSaver from 'file-saver';
import pubsub from 'pubsub-js';
import { STAGE_GENERATED, CNC_GCODE_SUFFIX } from '../../constants';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        // from redux
        stage: PropTypes.number.isRequired,
        workState: PropTypes.string.isRequired,
        gcodeStr: PropTypes.string.isRequired,
        imageSrc: PropTypes.string.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const { gcodeStr } = this.props;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            const fileName = this.getGcodeFileName();
            pubsub.publish(
                'gcode:upload',
                {
                    gcode: gcodeStr,
                    meta: {
                        name: fileName
                    }
                }
            );
        },
        onExport: () => {
            const { gcodeStr } = this.props;
            const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
            const fileName = this.getGcodeFileName();
            FileSaver.saveAs(blob, fileName, true);
        }
    };

    getGcodeFileName() {
        const { imageSrc } = this.props;
        return `${path.basename(imageSrc)}${CNC_GCODE_SUFFIX}`;
    }

    render() {
        const disabled = this.props.workState === 'running'
            || this.props.stage < STAGE_GENERATED;

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
    return {
        stage: state.cnc.stage,
        workState: state.cnc.workState,
        gcodeStr: state.cnc.output.gcodeStr,
        imageSrc: state.cnc.imageParams.imageSrc
    };
};

export default connect(mapStateToProps)(Output);

