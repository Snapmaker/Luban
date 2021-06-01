import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as editorActions } from '../../../flux/editor';


class VisualizerTool extends PureComponent {
    static propTypes = {
        insertDefaultTextVector: PropTypes.func.isRequired
    };

    actions = {
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        }
    };

    render() {
        return (
            <React.Fragment>
                <div className={classNames(styles['visualizer-center'])}>
                    <Anchor
                        componentClass="button"
                        className={styles['btn-center']}
                        onClick={this.actions.onClickInsertText}
                    >
                        <div className={styles['btn-text']} />
                    </Anchor>
                </div>
            </React.Fragment>
        );
    }
}

// const mapStateToProps = (state) => {
//     return {
//
//     };
// };

const mapDispatchToProps = (dispatch) => ({
    insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('cnc'))
});


export default connect(null, mapDispatchToProps)(VisualizerTool);
