import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { Edit, Hide, Show } from 'snapmaker-react-icon';

import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../flux/editor';
import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import ToolPathConfigurations from '../../../views/ToolPathConfigurations/ToolPathConfigurations';

class ToolPathListBox extends PureComponent {
    static propTypes = {
        headType: PropTypes.string.isRequired,
        setTitle: PropTypes.func.isRequired,

        toolPaths: PropTypes.array.isRequired,
        selectedToolPathId: PropTypes.string,

        selectToolPathId: PropTypes.func.isRequired,
        updateToolPath: PropTypes.func.isRequired,
        updatingToolPath: PropTypes.func.isRequired,

        previewFailed: PropTypes.bool.isRequired
    };

    state = {
    }


    thumbnail = React.createRef();

    contextMenuRef = React.createRef();

    actions = {
        selectToolPathId: (id) => {
            this.props.selectToolPathId(id);
        },
        onClickVisible: (id, visible, check) => {
            this.props.updateToolPath(id, {
                visible: !visible,
                check: !check
            });
        },

        onDoubleClickToolPath: (toolPath) => {
            this.props.updatingToolPath(toolPath.id);
        },

        limitTheLengthOfDisplayName: (name) => {
            let newName = name;
            if (newName.length > 36) {
                newName = `${newName.slice(0, 24)}...${newName.slice(-9)}`;
            }
            return newName;
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Toolpath List'));
    }

    componentDidMount() {
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.previewFailed && !this.props.previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }

    render() {
        const { toolPaths } = this.props;

        const getIconStatus = (status) => {
            if (status === 'running') {
                return styles.iconRunning;
            } else if (status === 'warning') {
                return styles.iconWarning;
            } else if (status === 'failed') {
                return styles.iconError;
            }
            return '';
        };

        return (
            <div>
                <div className={styles['object-list-box']}>
                    {toolPaths.map((toolPath) => {
                        return (
                            <TipTrigger
                                key={toolPath.id}
                                title={i18n._('Object')}
                                content={toolPath.name}
                            >
                                <div>
                                    <div
                                        className={classNames(
                                            styles['object-list-item'],
                                            'clearfix',
                                            toolPath.id === this.props.selectedToolPathId ? styles.selected : null,
                                        )}
                                    >
                                        {/** <Anchor
                                            className={classNames(
                                                styles.icon,
                                                toolPath.check ? styles.iconCheck : styles.iconUncheck
                                            )}
                                            onClick={() => this.actions.onClickCheck(toolPath.id, toolPath.check)}
                                        />**/}
                                        <Anchor
                                            className={classNames(
                                                styles.name,
                                                styles.bt
                                            )}
                                            onClick={() => this.actions.selectToolPathId(toolPath.id)}
                                            // onDoubleClick={() => this.actions.onDoubleClickToolPath(toolPath)}
                                        >
                                            <span>
                                                {toolPath.name}
                                            </span>
                                        </Anchor>
                                        <div className={classNames(
                                            styles.iconWrapper
                                        )}
                                        >
                                            <i className={classNames(
                                                styles.icon,
                                                getIconStatus(toolPath.status)
                                            )}
                                            />
                                            <Anchor
                                                className={classNames(
                                                    styles.icon,
                                                )}
                                                title={i18n._('Edit')}
                                                onClick={() => this.props.updatingToolPath(toolPath.id)}
                                            >
                                                <Edit size={22} />
                                            </Anchor>
                                            {!toolPath.visible && (
                                                <Anchor
                                                    className={classNames(
                                                        styles.icon,
                                                    )}
                                                    title={i18n._('Show')}
                                                    onClick={() => this.actions.onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                                                >
                                                    <Hide color="#ccc" size={22} />
                                                </Anchor>
                                            )}
                                            {toolPath.visible && (
                                                <Anchor
                                                    className={classNames(
                                                        styles.icon,
                                                    )}
                                                    title={i18n._('Hide')}
                                                    onClick={() => this.actions.onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                                                >
                                                    <Show size={22} />
                                                </Anchor>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TipTrigger>
                        );
                    })}
                </div>
                <ToolPathConfigurations
                    headType={this.props.headType}
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    // eslint-disable-next-line no-unused-vars
    const { toolPathGroup, previewFailed } = state[ownProps.headType];

    const toolPaths = toolPathGroup.getToolPaths();

    return {
        toolPaths,
        headType: ownProps.headType,
        selectedToolPathId: toolPathGroup.selectedToolPathId,
        previewFailed
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        selectToolPathId: (id) => dispatch(editorActions.selectToolPathId(ownProps.headType, id)),
        updateToolPath: (id, newState) => dispatch(editorActions.updateToolPath(ownProps.headType, id, newState)),
        hideSelectedModel: () => dispatch(editorActions.hideSelectedModel(ownProps.headType)),
        showSelectedModel: () => dispatch(editorActions.showSelectedModel(ownProps.headType)),
        updatingToolPath: (toolPathId) => dispatch(editorActions.updatingToolPath(ownProps.headType, toolPathId))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ToolPathListBox);
