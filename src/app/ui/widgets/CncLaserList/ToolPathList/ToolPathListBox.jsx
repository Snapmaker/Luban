import React, { useState, useEffect } from 'react';
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
    PAGE_PROCESS
} from '../../../../constants';
// import { actions as cncActions } from '../../../../flux/cnc';


const ToolpathItem = ({ toolPath, selectedToolPathIDArray, selectToolPathId, selectOneToolPathId, selectToolPathById, onClickVisible, setEditingToolpath, disabled }) => {
    if (!toolPath) {
        return null;
    }
    function handleOnDoubleClick() {
        setEditingToolpath(toolPath);
        selectToolPathById(toolPath.id);
    }
    function handleOnClick(e) {
        if (e.detail > 1) { // Check difference to double click
            return;
        }
        if (e.shiftKey) {
            selectToolPathId(toolPath.id);
        } else {
            selectOneToolPathId(toolPath.id);
        }
    }
    const suffixLength = 6;
    const { prefixName, suffixName } = normalizeNameDisplay(toolPath.name, suffixLength);

    return (
        <TipTrigger
            key={toolPath.id}
            title={i18n._('Object')}
            content={toolPath.name}
        >
            <div
                className={classNames(
                    styles['object-list-item'],
                    'padding-horizontal-16',
                    'sm-flex',
                    'justify-space-between',
                    selectedToolPathIDArray.includes(toolPath.id) ? styles.selected : null
                )}
            >
                <Anchor
                    className={classNames(
                        'height-24',
                        'sm-flex',
                        'sm-flex-width'
                    )}
                    onDoubleClick={handleOnDoubleClick}
                    onClick={handleOnClick}
                >
                    <span>
                        {prefixName}
                    </span>
                    <span>
                        {suffixName}
                    </span>
                </Anchor>
                <div className={classNames('sm-flex', 'height-24')}>
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
                            type="static"
                            title={i18n._('Hide')}
                            onClick={() => onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                            disabled={disabled}
                        />
                    )}
                    {toolPath.visible && (
                        <SvgIcon
                            type="static"
                            size={24}
                            name="ShowNormal"
                            title={i18n._('Show')}
                            onClick={() => onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
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

    setEditingToolpath: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired
};


const ToolPathListBox = (props) => {
    const page = useSelector(state => state[props.headType]?.page);
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const selectedToolPathIDArray = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathArray, shallowEqual);
    const inProgress = useSelector(state => state[props.headType]?.inProgress);
    // const selectedToolPath = toolPaths && selectedToolPathIDArray.length === 1 && toolPaths.find(v => v.id === selectedToolPathIDArray[0]);
    const selectedToolPath = useSelector(state => state[props.headType]?.toolPathGroup?.singleToolPath, shallowEqual);
    const dispatch = useDispatch();

    // console.log('selectedToolPath', selectedToolPath);
    const selectedToolPathId = selectedToolPath.id;
    const [editingToolpath, setEditingToolpath] = useState(null);

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
            dispatch(editorActions.resetProcessState(props.headType));
        },
        deleteToolPath: () => dispatch(editorActions.deleteToolPath(props.headType, selectedToolPathIDArray)),
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(props.headType, toolPathId)),
        toolPathToUp: () => {
            if (selectedToolPathIDArray.length === 1) {
                dispatch(editorActions.toolPathToUp(props.headType, selectedToolPathIDArray[0]));
            }
        },
        toolPathToDown: () => {
            if (selectedToolPathIDArray.length === 1) {
                dispatch(editorActions.toolPathToDown(props.headType, selectedToolPathIDArray[0]));
            }
        },
        createToolPath: () => {
            const toolpath = dispatch(editorActions.createToolPath(props.headType));
            setEditingToolpath(toolpath);
        },
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
                <div className={classNames(
                    'height-176',
                    'align-c',
                    'padding-vertical-4'
                )}
                >
                    {toolPaths.length === 0 && (
                        <div className={classNames(
                            'font-roboto',
                            'border-radius-8',
                            'display-inline',
                            'height-40',
                            'padding-horizontal-16',
                            'border-default-blue',
                            'background-color-blue'
                        )}
                        >
                            {i18n._('Select object to create toolPath')}
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
                    'clearfix'
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
                            title={i18n._('Delete')}
                            onClick={() => actions.deleteToolPath(selectedToolPathId)}
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
                            title={i18n._('Prioritize')}
                            onClick={() => actions.toolPathToUp(selectedToolPathIDArray)}
                            name="Prioritize"
                            size={24}
                        />
                        <SvgIcon
                            disabled={selectedToolPathIDArray.length !== 1}
                            title={i18n._('Deprioritize')}
                            onClick={() => actions.toolPathToDown(selectedToolPathIDArray)}
                            name="Deprioritize"
                            size={24}
                        />
                    </div>
                    <Button
                        type="primary"
                        priority="level-three"
                        width="100%"
                        onClick={actions.createToolPath}
                        disabled={inProgress}
                    >
                        {i18n._('Create Toolpath')}
                    </Button>
                </div>
            </div>
            {editingToolpath && (
                <ToolPathConfigurations
                    headType={props.headType}
                    toolpath={editingToolpath}
                    onClose={() => setEditingToolpath(null)}
                />
            )}
            {selectedToolPath && (
                <ToolPathFastConfigurations
                    headType={props.headType}
                    setEditingToolpath={setEditingToolpath}
                    toolpath={selectedToolPath}
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
