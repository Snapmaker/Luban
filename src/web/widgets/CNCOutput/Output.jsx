import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import { STAGE_GENERATED } from '../../constants';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        // from redux
        stage: PropTypes.number.isRequired,
        workState: PropTypes.string.isRequired,
        output: PropTypes.object.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const gcodePath = this.props.output.gcodePath;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodePath, (result) => {
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodePath } });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodePath = this.props.output.gcodePath;
            document.location.href = '/api/gcode/download_cache?filename=' + gcodePath;
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
        stage: state.cnc.stage,
        workState: state.cnc.workState,
        output: state.cnc.output
    };
};

export default connect(mapStateToProps)(Output);
