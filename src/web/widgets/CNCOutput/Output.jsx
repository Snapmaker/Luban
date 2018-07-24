import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import { WEB_CACHE_IMAGE, STAGE_GENERATED } from '../../constants';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        output: PropTypes.object.isRequired,
        workState: PropTypes.string.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const gcodePath = `${WEB_CACHE_IMAGE}/${this.props.output.gcodePath}`;
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
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={this.actions.onLoadGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%' }}
                >
                    Load
                </button>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-white'])}
                    onClick={this.actions.onExport}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    Export
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
