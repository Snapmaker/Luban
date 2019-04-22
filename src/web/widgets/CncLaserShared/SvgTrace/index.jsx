import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from '../styles.styl';
import TracePreview from './TracePreview';
import i18n from '../../../lib/i18n';

class SvgTrace extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            mode: PropTypes.string.isRequired,
            options: PropTypes.object.isRequired,
            traceFilenames: PropTypes.array.isRequired,
            status: PropTypes.string.isRequired,
            modalSetting: PropTypes.object.isRequired,
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            processTrace: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['trace-title']}>
                    {i18n._('Finetune Trace')}
                </div>
                <TracePreview
                    state={this.props.state}
                    actions={this.props.actions}
                />
            </div>
        );
    }
}

export default SvgTrace;
