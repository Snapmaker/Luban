import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import styles from '../styles.styl';
import TracePreview from './TracePreview';


class SvgTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
    };

    state = {
    };

    actions = {
        printSquareTrace: () => {
            // const { size } = this.props;
            // const { sideLength } = this.props.state;
        }
    };

    render() {
        const { size } = this.props;
        const actions = { ...this.props.actions, ...this.actions };
        // const state = { ...this.props.state, ...this.state };

        const maxSideLength = Math.min(size.x, size.y);
        // const minSideLength = Math.min(maxSideLength / 2, maxSideLength);

        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Print Square Trace')}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <TracePreview
                        size={size}
                        sideLength={maxSideLength}
                        width={400}
                        height={400}
                    />
                </div>
                <div style={{ margin: '20px 60px' }}>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={actions.printSquareTrace}
                        style={{ width: '40%', float: 'left' }}
                    >
                        {i18n._('TODO1')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={actions.displayExtractTrace}
                        style={{ width: '40%', float: 'right' }}
                    >
                        {i18n._('TODO2')}
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        size: machine.size
    };
};

const mapDispatchToProps = (dispatch) => ({
});


export default connect(mapStateToProps, mapDispatchToProps)(SvgTrace);
