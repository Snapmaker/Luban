import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions } from '../../flux/cncLaserShared';


class VisualizerTopLeft extends PureComponent {
    static propTypes = {
        canUndo: PropTypes.bool.isRequired,
        canRedo: PropTypes.bool.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired
    };

    actions = {
        undo: () => {
            this.props.undo();
        },
        redo: () => {
            this.props.redo();
        }
    };

    render() {
        // const actions = this.actions;
        const { canUndo, canRedo } = this.props;
        return (
            <React.Fragment>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={this.actions.undo}
                    disabled={!canUndo}
                >
                    <div className={styles['btn-undo']} />
                </Anchor>
                <Anchor
                    componentClass="button"
                    className={styles['btn-top-left']}
                    onClick={this.actions.redo}
                    disabled={!canRedo}
                >
                    <div className={styles['btn-redo']} />
                </Anchor>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { canUndo, canRedo } = state.laser;

    return {
        canUndo,
        canRedo
    };
};

const mapDispatchToProps = (dispatch) => ({
    undo: () => dispatch(actions.undo('laser')),
    redo: () => dispatch(actions.redo('laser'))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerTopLeft);
