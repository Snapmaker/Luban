import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Delete, Refresh, Up, Down } from 'snapmaker-react-icon';
import i18n from '../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../flux/editor';
// import TipTrigger from '../../../components/TipTrigger';
class ToolPathFooter extends PureComponent {
    static propTypes = {
        selectedToolPathId: PropTypes.string,
        toolPaths: PropTypes.array,

        deleteToolPath: PropTypes.func.isRequired,
        commitGenerateToolPath: PropTypes.func.isRequired,
        toolPathToUp: PropTypes.func.isRequired,
        toolPathToDown: PropTypes.func.isRequired
    };

    actions = {
        recalculateAllToolPath: () => {
            this.props.toolPaths.forEach((toolPath) => {
                if (toolPath.status === 'warning') {
                    this.props.commitGenerateToolPath(toolPath.id);
                }
            });
        }
    }


    render() {
        const { selectedToolPathId, toolPaths } = this.props;

        const disabled = !selectedToolPathId;

        return (
            <div className={classNames(
                styles.toolPathFooter,
                'clearfix'
            )}
            >
                <div className={classNames(
                    styles.left
                )}
                >
                    <Anchor
                        className={classNames(
                            styles.icon,
                        )}
                        disabled={disabled}
                        title={i18n._('Delete')}
                        onClick={() => this.props.deleteToolPath(selectedToolPathId)}
                    >
                        <Delete disabled={disabled} size={22} />
                    </Anchor>
                    <Anchor
                        className={classNames(
                            styles.icon,
                        )}
                        title={i18n._('Recalculate All')}
                        onClick={() => this.actions.recalculateAllToolPath()}
                    >
                        <Refresh disabled={!toolPaths.length > 0} size={22} />

                    </Anchor>
                </div>
                <div className={classNames(
                    styles.right,
                )}
                >
                    <Anchor
                        className={classNames(
                            styles.icon,
                        )}
                        disabled={disabled}
                        title={i18n._('Prioritize')}
                        onClick={() => this.props.toolPathToUp(selectedToolPathId)}

                    >
                        <Up disabled={disabled} size={22} />
                    </Anchor>

                    <Anchor
                        className={classNames(
                            styles.icon,
                        )}
                        disabled={disabled}
                        title={i18n._('Deprioritize')}
                        onClick={() => this.props.toolPathToDown(selectedToolPathId)}
                    >
                        <Down disabled={disabled} size={22} />

                    </Anchor>


                </div>
            </div>
        );
    }
}

// eslint-disable-next-line no-unused-vars
const mapStateToProps = (state, ownProps) => {
    const { toolPathGroup } = state[ownProps.headType];

    return {
        selectedToolPathId: toolPathGroup.selectedToolPathId,
        toolPaths: toolPathGroup.toolPaths
    };
};

// eslint-disable-next-line no-unused-vars
const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        // updatingToolPath: (toolPathId) => dispatch(editorActions.updatingToolPath(ownProps.headType, toolPathId)),
        deleteToolPath: (toolPathId) => dispatch(editorActions.deleteToolPath(ownProps.headType, toolPathId)),
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(ownProps.headType, toolPathId)),
        toolPathToUp: (toolPathId) => dispatch(editorActions.toolPathToUp(ownProps.headType, toolPathId)),
        toolPathToDown: (toolPathId) => dispatch(editorActions.toolPathToDown(ownProps.headType, toolPathId))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolPathFooter);
