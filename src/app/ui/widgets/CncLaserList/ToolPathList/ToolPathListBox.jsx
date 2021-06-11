import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import SvgIcon from '../../../components/SvgIcon';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../../flux/editor';
// import modal from '../../../lib/modal';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import ToolPathConfigurations from '../../../views/ToolPathConfigurations/ToolPathConfigurations';


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
const ToolpathItem = ({ toolPath, selectedToolPathId, selectToolPathId, onClickVisible, setEditingToolpath }) => {
    if (!toolPath) {
        return null;
    }
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
                        toolPath.id === selectedToolPathId ? styles.selected : null,
                    )}
                >
                    <Anchor
                        className={classNames(
                            styles.name,
                            styles.process,
                            styles.bt
                        )}
                        onClick={() => selectToolPathId(toolPath.id)}
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
                        <SvgIcon
                            size={22}
                            name="Edit"
                            className={classNames(
                                styles.icon,
                            )}
                            title={i18n._('Edit')}
                            onClick={() => setEditingToolpath(toolPath)}
                        />
                        {!toolPath.visible && (
                            <SvgIcon
                                size={22}
                                color="#BFBFBF"
                                name="Hide"
                                className={classNames(
                                    styles.icon,
                                )}
                                title={i18n._('Hide')}
                                onClick={() => onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                            />
                        )}
                        {toolPath.visible && (
                            <SvgIcon
                                size={22}
                                name="Show"
                                className={classNames(
                                    styles.icon,
                                )}
                                title={i18n._('Show')}
                                onClick={() => onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </TipTrigger>
    );
};
ToolpathItem.propTypes = {
    toolPath: PropTypes.object.isRequired,
    selectedToolPathId: PropTypes.string.isRequired,
    selectToolPathId: PropTypes.func.isRequired,
    onClickVisible: PropTypes.func.isRequired,
    setEditingToolpath: PropTypes.func.isRequired
};

const ToolPathListBox = (props) => {
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const selectedToolPathId = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathId, shallowEqual);
    const dispatch = useDispatch();
    const [editingToolpath, setEditingToolpath] = useState(null);
    const actions = {
        selectToolPathId: (id) => {
            dispatch(editorActions.selectToolPathId(props.headType, id));
        },
        onClickVisible: (id, visible, check) => {
            dispatch(editorActions.updateToolPath(props.headType, id, {
                visible: !visible,
                check: !check
            }));
        },
        deleteToolPath: (toolPathId) => dispatch(editorActions.deleteToolPath(props.headType, toolPathId)),
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(props.headType, toolPathId)),
        toolPathToUp: (toolPathId) => dispatch(editorActions.toolPathToUp(props.headType, toolPathId)),
        toolPathToDown: (toolPathId) => dispatch(editorActions.toolPathToDown(props.headType, toolPathId)),
        recalculateAllToolPath: () => {
            toolPaths.forEach((toolPath) => {
                if (toolPath.status === 'warning') {
                    actions.commitGenerateToolPath(toolPath.id);
                }
            });
        }
    };
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('Toolpath List'));
    }, []);

    const disabled = !selectedToolPathId;
    return (
        <div>
            <div className={styles['object-list-box']}>
                {toolPaths && toolPaths.map((toolPath) => {
                    return (
                        <ToolpathItem
                            toolPath={toolPath}
                            key={toolPath.id}
                            selectedToolPathId={selectedToolPathId}
                            selectToolPathId={actions.selectToolPathId}
                            onClickVisible={actions.onClickVisible}
                            setEditingToolpath={setEditingToolpath}
                        />
                    );
                })}
            </div>
            <div className={classNames(
                styles.toolPathFooter,
                'clearfix'
            )}
            >
                <div className={classNames(
                    styles.left
                )}
                >
                    <SvgIcon
                        className={classNames(
                            styles.icon,
                        )}
                        name="Delete"
                        disabled={disabled}
                        size={24}
                        title={i18n._('Delete')}
                        onClick={() => actions.deleteToolPath(selectedToolPathId)}
                    />
                    <SvgIcon
                        className={classNames(
                            styles.icon,
                        )}
                        title={i18n._('Recalculate All')}
                        onClick={() => actions.recalculateAllToolPath()}
                        name="Refresh"
                        disabled={!toolPaths.length > 0}
                        size={24}
                    />
                </div>
                <div className={classNames(
                    styles.right,
                )}
                >
                    <SvgIcon
                        className={classNames(
                            styles.icon,
                        )}
                        disabled={disabled}
                        title={i18n._('Prioritize')}
                        onClick={() => actions.toolPathToUp(selectedToolPathId)}
                        name="Up"
                        size={24}
                    />
                    <SvgIcon
                        className={classNames(
                            styles.icon,
                            styles.rotate180
                        )}
                        disabled={disabled}
                        title={i18n._('Deprioritize')}
                        onClick={() => actions.toolPathToDown(selectedToolPathId)}
                        name="Up"
                        size={24}
                    />
                </div>
            </div>
            {editingToolpath && (
                <ToolPathConfigurations
                    headType={props.headType}
                    toolpath={editingToolpath}
                    onClose={() => setEditingToolpath(null)}
                />
            )}
        </div>
    );
};
ToolPathListBox.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    headType: PropTypes.string
};
export default ToolPathListBox;
