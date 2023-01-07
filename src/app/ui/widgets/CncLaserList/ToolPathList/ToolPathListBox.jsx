import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
// import { cloneDeep, isNull } from 'lodash';
import SvgIcon from '../../../components/SvgIcon';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../../flux/editor';
// import modal from '../../../lib/modal';
import i18n from '../../../../lib/i18n';
// import { toHump } from '../../../../../shared/lib/utils';
import { normalizeNameDisplay } from '../../../../lib/normalize-range';
import TipTrigger from '../../../components/TipTrigger';
import ToolPathConfigurations from '../../../views/ToolPathConfigurations/ToolPathConfigurations';
import ToolPathFastConfigurations from '../../../views/ToolPathConfigurations/ToolPathFastConfigurations';

import {
    PAGE_EDITOR,
    PAGE_PROCESS,
    DISPLAYED_TYPE_TOOLPATH
} from '../../../../constants';
import ContextMenu from '../../../components/ContextMenu';


const ToolpathItem = ({
    toolPath, selectedToolPathIDArray, selectToolPathId, selectOneToolPathId, selectToolPathById,
    onClickVisible, setEditingToolpath, disabled, showContextMenu
}) => {
    if (!toolPath) {
        return null;
    }
    function handleOnDoubleClick(e) {
        e.stopPropagation();
        setEditingToolpath(toolPath);
        selectToolPathById(toolPath.id);
    }
    function handleOnClick(e) {
        e.stopPropagation();
        if (e.detail > 1) { // Check difference to double click
            return;
        }
        if (e.shiftKey) {
            selectToolPathId(toolPath.id);
        } else {
            selectOneToolPathId(toolPath.id);
        }
    }
    function handleOnClickVisible(e) {
        e.stopPropagation();
        onClickVisible(toolPath.id, toolPath.visible, toolPath.check);
    }
    const suffixLength = 6;
    const { prefixName, suffixName } = normalizeNameDisplay(toolPath.name, suffixLength);

    return (
        <TipTrigger
            key={toolPath.id}
            title={i18n._('key-CncLaser/ToolPathList/Button/-Object')}
            content={toolPath.name}
        >
            <div
                className={classNames(
                    styles['object-list-item'],
                    'sm-flex',
                    'justify-space-between',
                    selectedToolPathIDArray.includes(toolPath.id) ? styles.selected : null
                )}
                role="button"
                tabIndex="0"
                onMouseUp={(e) => {
                    if (e.button === 2) { // right click
                        // item is selected, do not select again
                        if (!(selectedToolPathIDArray.length === 1 && selectedToolPathIDArray[0] === toolPath.id)) {
                            selectOneToolPathId(toolPath.id);
                        }
                        e.persist();
                        showContextMenu(e);
                    }
                }}
            >
                <Anchor
                    className={classNames(
                        'height-24',
                        'width-254',
                        'align-l',
                        'sm-flex',
                        'sm-flex-width',
                        'margin-left-16',
                        'margin-right-16',
                    )}
                    onDoubleClick={handleOnDoubleClick}
                    onClick={handleOnClick}
                >
                    <span className={classNames(styles['prefix-name'])}>
                        {prefixName}
                    </span>
                    <span className={classNames(styles['suffix-name'])}>
                        {suffixName}
                    </span>
                </Anchor>
                <div className={classNames('sm-flex', 'height-24', 'margin-right-16')}>
                    <i
                        className={classNames(
                            // ...getIconStatus(toolPath.status)
                        )}
                    />
                    {!toolPath.visible && (
                        <SvgIcon
                            size={24}
                            color="#BFBFBF"
                            name="HideNormal"
                            type={['static']}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Hide')}
                            onClick={handleOnClickVisible}
                            disabled={disabled}
                        />
                    )}
                    {toolPath.visible && (
                        <SvgIcon
                            type={['static']}
                            size={24}
                            name="ShowNormal"
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Show')}
                            onClick={handleOnClickVisible}
                            disabled={disabled}
                        />
                    )}
                </div>
            </div>
        </TipTrigger>
    );
};
ToolpathItem.propTypes = {
    toolPath: PropTypes.object.isRequired,
    selectedToolPathIDArray: PropTypes.array.isRequired,
    selectToolPathId: PropTypes.func.isRequired,
    selectOneToolPathId: PropTypes.func.isRequired,
    selectToolPathById: PropTypes.func.isRequired,
    onClickVisible: PropTypes.func.isRequired,
    showContextMenu: PropTypes.func.isRequired,

    setEditingToolpath: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired
};


const ToolPathListBox = (props) => {
    const page = useSelector(state => state[props.headType]?.page);
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const selectedToolPathIDArray = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathArray, shallowEqual);
    const inProgress = useSelector(state => state[props.headType]?.inProgress);
    const displayedType = useSelector(state => state[props.headType]?.displayedType);
    const selectedModelArray = useSelector(state => state[props.headType]?.modelGroup?.getSelectedModelArray());
    const dispatch = useDispatch();

    const contextMenuDisabled = (selectedToolPathIDArray.length !== 1);
    const selectedFirstToolPathId = selectedToolPathIDArray.length === 1 ? selectedToolPathIDArray[0] : null;
    const selectedFirstToolPath = toolPaths.find(d => d.id === selectedFirstToolPathId);
    const [editingToolpath, setEditingToolpath] = useState(null);
    const contextMenuRef = useRef(null);
    const contextMenuArrangementDisabled = (toolPaths.length === 1);
    const actions = {
        selectOneToolPathId: (id) => {
            dispatch(editorActions.selectOneToolPathId(props.headType, id));
        },
        selectToolPathId: (id) => {
            dispatch(editorActions.selectToolPathId(props.headType, id));
        },
        selectToolPathById: (id) => {
            dispatch(editorActions.selectToolPathById(props.headType, id));
        },
        onClickVisible: (id, visible, check) => {
            dispatch(editorActions.updateToolPath(props.headType, id, {
                visible: !visible,
                check: !check
            }));
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                const hasToolPathVisible = toolPaths.some((toolPath) => {
                    return (toolPath.id === id && !visible) || (toolPath.id !== id && toolPath.visible);
                });
                if (hasToolPathVisible) {
                    dispatch(editorActions.refreshToolPathPreview(props.headType));
                }
            } else {
                dispatch(editorActions.resetProcessState(props.headType));
            }
        },
        deleteToolPath: () => {
            dispatch(editorActions.deleteToolPath(props.headType, selectedToolPathIDArray));
            dispatch(editorActions.refreshToolPathPreview(props.headType));
        },
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(props.headType, toolPathId)),
        toolPathToUp: () => {
            if (selectedFirstToolPathId && toolPaths[0].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToUp(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToDown: () => {
            if (selectedFirstToolPathId && toolPaths[toolPaths.length - 1].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToDown(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToTop: () => {
            if (selectedFirstToolPathId && toolPaths[0].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToTop(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToBottom: () => {
            if (selectedFirstToolPathId && toolPaths[toolPaths.length - 1].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToBottom(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        createToolPath: () => {
            const toolpath = dispatch(editorActions.createToolPath(props.headType));
            setEditingToolpath(toolpath);
        },
        showContextMenu: (event) => {
            setTimeout(() => {
                contextMenuRef.current.show(event);
            }, 0);
        }
    };
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('key-CncLaser/ToolPathList/Button/-Toolpath List'));
    }, []);
    useEffect(() => {
        if (page === PAGE_EDITOR) {
            props.widgetActions.setDisplay(false);
        } else if (page === PAGE_PROCESS) {
            props.widgetActions.setDisplay(true);
        }
    }, [page]);

    return (
        <div className="clearfix">
            <div className={classNames(
                'border-default-grey-1',
                'border-radius-8',
                'margin-top-8'
            )}
            >
                <div
                    className={classNames(
                        'height-184',
                        'position-re',
                        // // 'align-c',
                        'padding-vertical-4'
                    )}
                    tabIndex="-1"
                    role="button"
                    onKeyDown={() => { }}
                    onClick={() => {
                        actions.selectToolPathById();
                    }}
                >
                    {toolPaths.length === 0 && (
                        <div className={classNames(
                            // 'font-roboto',
                            'padding-horizontal-16',
                            'sm-flex',
                            'position-absolute',
                            'top-50-percent',
                            'width-percent-100',
                            'justify-center'
                        )}
                        >
                            <SvgIcon
                                name="WarningTipsTips"
                                type={['static']}
                                color="#1890ff"
                            />
                            {/* <SvgIcon
                                name="WarningTipsTips"
                                type={['static']}
                                color="#1890ff"
                            /> */}
                            <span className={classNames('display-inline')}>{i18n._('key-CncLaser/ToolPathList/Button/-Select object to create toolpath')}</span>
                        </div>
                    )}

                    <div className={styles['object-list-box']}>
                        {toolPaths && toolPaths.map((toolPath) => {
                            return (
                                <ToolpathItem
                                    toolPath={toolPath}
                                    key={toolPath.id}
                                    selectedToolPathIDArray={selectedToolPathIDArray}
                                    selectOneToolPathId={actions.selectOneToolPathId}
                                    selectToolPathId={actions.selectToolPathId}
                                    selectToolPathById={actions.selectToolPathById}
                                    onClickVisible={actions.onClickVisible}
                                    setEditingToolpath={setEditingToolpath}
                                    showContextMenu={actions.showContextMenu}
                                    disabled={inProgress}
                                />
                            );
                        })}
                    </div>
                </div>
                <div className={classNames(
                    'border-radius-bottom-8',
                    'padding-horizontal-16',
                    'module-default-shadow',
                    'padding-bottom-16',
                    'clearfix',
                    // 'height-96',
                    // 'padding-top-8'
                    `${toolPaths.length !== 0 ? 'padding-top-8' : ''}`
                )}
                >
                    <div className={classNames(
                        'float-l',
                        'margin-vertical-4',
                    )}
                    >
                        <SvgIcon
                            name="Delete"
                            disabled={selectedToolPathIDArray.length < 1}
                            size={24}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Delete')}
                            onClick={() => actions.deleteToolPath(selectedFirstToolPathId)}
                        />
                    </div>
                    <div className={classNames(
                        'float-r',
                        'margin-vertical-4',
                    )}
                    >
                        <SvgIcon
                            className={classNames(
                                'margin-horizontal-8',
                            )}
                            disabled={selectedToolPathIDArray.length !== 1}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Prioritize')}
                            onClick={() => actions.toolPathToUp(selectedToolPathIDArray)}
                            name="Prioritize"
                            size={24}
                        />
                        <SvgIcon
                            disabled={selectedToolPathIDArray.length !== 1}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Deprioritize')}
                            onClick={() => actions.toolPathToDown(selectedToolPathIDArray)}
                            name="Deprioritize"
                            size={24}
                        />
                    </div>
                    <Button
                        type="default"
                        priority="level-two"
                        width="100%"
                        onClick={actions.createToolPath}
                        disabled={inProgress || (!selectedModelArray || selectedModelArray.length === 0)}
                    >
                        {i18n._('key-CncLaser/ToolPathList/Button/-Create Toolpath')}
                    </Button>
                </div>
            </div>
            <ContextMenu
                id="toolPathListBoxContextmenu"
                ref={contextMenuRef}
                menuItems={
                    [
                        {
                            type: 'item',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Edit'),
                            disabled: contextMenuDisabled,
                            onClick: () => {
                                setEditingToolpath(selectedFirstToolPath);
                            }
                        },
                        {
                            type: 'item',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Delete'),
                            disabled: contextMenuDisabled,
                            onClick: () => actions.deleteToolPath(selectedFirstToolPathId)
                        },
                        {
                            type: 'subMenu',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Sort'),
                            disabled: contextMenuDisabled || contextMenuArrangementDisabled,
                            items: [
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Prioritize'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToUp(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Deprioritize'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToDown(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Top'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToTop(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Bottom'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToBottom(selectedToolPathIDArray)
                                }
                            ]
                        }
                    ]
                }
            />
            {editingToolpath && (
                <ToolPathConfigurations
                    headType={props.headType}
                    toolpath={editingToolpath}
                    onClose={() => setEditingToolpath(null)}
                />
            )}
            {selectedFirstToolPath && (
                <ToolPathFastConfigurations
                    headType={props.headType}
                    setEditingToolpath={setEditingToolpath}
                    toolpath={selectedFirstToolPath}
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
