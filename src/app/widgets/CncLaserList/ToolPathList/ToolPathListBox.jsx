import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';
import SvgIcon from '../../../components/SvgIcon';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../flux/editor';
// import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
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
const ToolpathItem = (props) => {
    const { toolPath, selectedToolPathId, selectToolPathId, onClickVisible, updatingToolPath } = props;
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
                            onClick={() => updatingToolPath(toolPath.id)}
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
    updatingToolPath: PropTypes.func.isRequired
};

const ToolPathListBox = (props) => {
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths());
    const selectedToolPathId = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathId);
    const dispatch = useDispatch();
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
        updatingToolPath: (toolPathId) => {
            dispatch(editorActions.updatingToolPath(props.headType, toolPathId));
        }
    };
    useEffect(() => {
        props.setTitle(i18n._('Toolpath List'));
    }, []);

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
                            updatingToolPath={actions.updatingToolPath}
                        />
                    );
                })}
            </div>
            <ToolPathConfigurations
                headType={props.headType}
            />
        </div>
    );
};
ToolPathListBox.propTypes = {
    setTitle: PropTypes.func,
    headType: PropTypes.string
};
export default ToolPathListBox;
