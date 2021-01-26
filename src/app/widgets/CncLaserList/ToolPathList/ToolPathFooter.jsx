import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../flux/editor';

class ToolPathFooter extends PureComponent {
    static propTypes = {
        selectedToolPathId: PropTypes.string,

        updatingToolPath: PropTypes.func.isRequired,
        deleteToolPath: PropTypes.func.isRequired,
        commitGenerateToolPath: PropTypes.func.isRequired,
        toolPathToUp: PropTypes.func.isRequired,
        toolPathToDown: PropTypes.func.isRequired
    };


    render() {
        const { selectedToolPathId } = this.props;

        const disabled = !selectedToolPathId;

        return (
            <div className={styles.toolPathFooter}>
                <div className={styles.left}>
                    <Anchor
                        className={classNames(
                            styles.icon,
                            styles.iconEdit
                        )}
                        disabled={disabled}
                        onClick={() => this.props.updatingToolPath(selectedToolPathId)}
                    />
                    <Anchor
                        className={classNames(
                            styles.icon,
                            styles.iconDelete
                        )}
                        disabled={disabled}
                        onClick={() => this.props.deleteToolPath(selectedToolPathId)}
                    />
                    <Anchor
                        className={classNames(
                            styles.icon,
                            styles.iconRefresh
                        )}
                        disabled={disabled}
                        onClick={() => this.props.commitGenerateToolPath(selectedToolPathId)}
                    />
                </div>
                <div className={styles.right}>
                    <Anchor
                        className={classNames(
                            styles.icon,
                            styles.iconUp
                        )}
                        disabled={disabled}
                        onClick={() => this.props.toolPathToUp(selectedToolPathId)}
                    />
                    <Anchor
                        className={classNames(
                            styles.icon,
                            styles.iconDown
                        )}
                        disabled={disabled}
                        onClick={() => this.props.toolPathToDown(selectedToolPathId)}
                    />
                </div>
            </div>
        );
    }
}

// eslint-disable-next-line no-unused-vars
const mapStateToProps = (state, ownProps) => {
    const { toolPathGroup } = state[ownProps.headType];

    const selectedToolPathId = toolPathGroup.selectedToolPathId;

    return {
        selectedToolPathId
    };
};

// eslint-disable-next-line no-unused-vars
const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        updatingToolPath: (toolPathId) => dispatch(editorActions.updatingToolPath(ownProps.headType, toolPathId)),
        deleteToolPath: (toolPathId) => dispatch(editorActions.deleteToolPath(ownProps.headType, toolPathId)),
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(ownProps.headType, toolPathId)),
        toolPathToUp: (toolPathId) => dispatch(editorActions.toolPathToUp(ownProps.headType, toolPathId)),
        toolPathToDown: (toolPathId) => dispatch(editorActions.toolPathToDown(ownProps.headType, toolPathId))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolPathFooter);
