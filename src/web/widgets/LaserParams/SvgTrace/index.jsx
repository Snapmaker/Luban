import React, { PureComponent } from 'react';
// import { connect } from 'react-redux';
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
            showModal: PropTypes.bool.isRequired
        }),
        actions: PropTypes.shape({
            hideModal: PropTypes.func.isRequired,
            updateOptions: PropTypes.func.isRequired
        })
    };

    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Trace')}
                </div>
                <div style={{ float: 'left', textAlign: 'center' }}>
                    <TracePreview
                        width={400}
                        height={400}
                        state={this.props.state}
                        actions={this.props.actions}
                    />
                </div>
            </div>
        );
    }
}

// export default connect(mapStateToProps, mapDispatchToProps)(SvgTrace);
export default SvgTrace;
