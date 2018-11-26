import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import FileSaver from 'file-saver';
import { connect } from 'react-redux';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { STAGE_GENERATED } from '../../constants';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        output: PropTypes.object.isRequired,
        workState: PropTypes.string.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const { mode, output } = this.props;
            const { gcodeStr } = output;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);

            pubsub.publish(
                'gcode:upload',
                {
                    gcode: gcodeStr,
                    meta: {
                        renderMethod: (mode === 'greyscale' ? 'point' : 'line')
                    }
                }
            );
        },
        onExport: () => {
            const { gcodeStr } = this.props.output;
            const blob = new Blob([gcodeStr], { type: 'text/plain;charset=utf-8' });
            let fileName = 'laser.nc';
            FileSaver.saveAs(blob, fileName, true);
        }
    };

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
        mode: state.laser.mode,
        stage: state.laser.stage,
        workState: state.laser.workState,
        output: state.laser.output
    };
};

export default connect(mapStateToProps)(Output);
