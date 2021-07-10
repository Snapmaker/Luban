import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import SvgIcon from '../../../components/SvgIcon';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../../flux/editor';
// import modal from '../../../lib/modal';
import i18n from '../../../../lib/i18n';
import { toHump } from '../../../../../shared/lib/utils';
import { normalizeNameDisplay } from '../../../../lib/normalize-range';
import TipTrigger from '../../../components/TipTrigger';
import ToolPathConfigurations from '../../../views/ToolPathConfigurations/ToolPathConfigurations';
import {
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION,
    HEAD_CNC,
    HEAD_LASER,
    PAGE_EDITOR,
    PAGE_PROCESS
} from '../../../../constants';
import ToolParameters from '../../../views/ToolPathConfigurations/cnc/ToolParameters';
import { actions as cncActions } from '../../../../flux/cnc';
import ToolSelector from '../../../views/ToolPathConfigurations/cnc/ToolSelector';

const getIconStatus = (status) => {
    if (status === 'running') {
        return [styles.icon, styles.iconRunning];
    } else if (status === 'warning') {
        return [styles.icon, styles.iconWarning];
    } else if (status === 'failed') {
        return [styles.icon, styles.iconError];
    }
    return [];
};
// 'Toolpath List'
const useExpandItem = (title) => {
    const [expanded, setExpanded] = useState(true);
    function handleClick() {
        setExpanded(!expanded);
    }
    function renderExpandItem() {
        return (
            <Anchor className="sm-flex height-32 margin-vertical-8" onClick={handleClick}>
                <span className="sm-flex-width">{i18n._(title)}</span>
                <SvgIcon
                    name="DropdownLine"
                    className={classNames(
                        expanded ? '' : 'rotate180'
                    )}
                />
            </Anchor>
        );
    }
    return [expanded, renderExpandItem];
};
const ToolpathItem = ({ toolPath, selectedToolPathId, selectToolPathId, onClickVisible, setEditingToolpath, disabled }) => {
    if (!toolPath) {
        return null;
    }
    function handleOnDoubleClick() {
        setEditingToolpath(toolPath);
        selectToolPathId(toolPath.id);
    }
    function handleOnClick(e) {
        if (e.detail > 1) { // Check difference to double click
            return;
        }
        selectToolPathId(toolPath.id);
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
                    toolPath.id === selectedToolPathId ? styles.selected : null,
                )}
            >
                <Anchor
                    className={classNames(
                        'height-24',
                        'sm-flex',
                        'sm-flex-width',
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
                            ...getIconStatus(toolPath.status)
                        )}
                    />
                    {!toolPath.visible && (
                        <SvgIcon
                            size={24}
                            color="#BFBFBF"
                            name="HideNormal"
                            title={i18n._('Hide')}
                            onClick={() => onClickVisible(toolPath.id, toolPath.visible, toolPath.check)}
                            disabled={disabled}
                        />
                    )}
                    {toolPath.visible && (
                        <SvgIcon
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
    selectedToolPathId: PropTypes.string.isRequired,
    selectToolPathId: PropTypes.func.isRequired,
    onClickVisible: PropTypes.func.isRequired,

    setEditingToolpath: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired
};

function getFastEditSettingsKeys(toolPath) {
    const { headType, type: toolPathType, gcodeConfig } = toolPath;

    if (headType === HEAD_CNC) {
        if (toolPathType === 'vector') {
            return [
                'pathType', 'targetDepth', 'work_speed', 'plunge_speed', 'step_down', 'step_over'
            ];
        }
        if (toolPathType === 'image') {
            return [
                'targetDepth', 'work_speed', 'plunge_speed', 'step_down', 'step_over'
            ];
        }
        if (toolPathType === 'sculpt') {
            if (toolPath.materials.isRotate) {
                return [
                    'sliceMode', 'work_speed', 'plunge_speed', 'step_down', 'step_over'
                ];
            } else {
                return [
                    'targetDepth', 'work_speed', 'plunge_speed', 'step_down', 'step_over'
                ];
            }
        }
    }
    if (headType === HEAD_LASER) {
        if (toolPathType === 'vector') {
            const multiPasses = gcodeConfig?.multiPasses;
            if (multiPasses === 1) {
                return [
                    'fill_enabled', 'work_speed', 'multi_passes', 'fixed_power'
                ];
            } else {
                return [
                    'fill_enabled', 'work_speed', 'multi_passes', 'multi_pass_depth', 'fixed_power'
                ];
            }
        }
        if (toolPathType === 'image') {
            const movementMode = gcodeConfig?.movementMode;
            if (movementMode === 'greyscale-line') {
                return [
                    'movement_mode', 'density', 'work_speed', 'fixed_power'
                ];
            }
            if (movementMode === 'greyscale-dot') {
                return [
                    'movement_mode', 'density', 'dwell_time', 'fixed_power'
                ];
            }
        }
    }
    return [];
}

const ToolPathListBox = (props) => {
    const page = useSelector(state => state[props.headType]?.page);
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const toolPathTypes = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPathTypes(), shallowEqual);
    const selectedToolPathId = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathId, shallowEqual);
    const inProgress = useSelector(state => state[props.headType]?.inProgress);
    const dispatch = useDispatch();
    const selectedToolPath = toolPaths && toolPaths.find(v => v.id === selectedToolPathId);
    const activeToolListDefinition = useSelector(state => state[props.headType]?.activeToolListDefinition, shallowEqual);
    const toolDefinitions = useSelector(state => state[props.headType]?.toolDefinitions, shallowEqual);
    const [expanded, renderExpandItem] = useExpandItem('Toolpath List');
    // ToolPath fast edit init
    const fastEditSettings = {};
    if (selectedToolPath) {
        const cncGcodeDefinition = CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION;
        const { gcodeConfig } = selectedToolPath;
        let allDefinition = {};
        if (props.headType === HEAD_CNC) {
            Object.keys(cncGcodeDefinition).forEach((key) => {
                cncGcodeDefinition[key].default_value = gcodeConfig[key];
                // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
                cncGcodeDefinition[key].isGcodeConfig = true;
            });
            allDefinition = {
                ...cncGcodeDefinition,
                ...activeToolListDefinition?.settings
            };
            if (activeToolListDefinition) {
                allDefinition.jog_speed.default_value = gcodeConfig?.jogSpeed;
                allDefinition.plunge_speed.default_value = gcodeConfig?.plungeSpeed;
                allDefinition.work_speed.default_value = gcodeConfig?.workSpeed;
                allDefinition.step_down.default_value = gcodeConfig?.stepDown;
                allDefinition.density.default_value = gcodeConfig?.density;
            }
        }
        if (props.headType === HEAD_LASER) {
            allDefinition = LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION;
            Object.keys(allDefinition).forEach((key) => {
                allDefinition[key].default_value = gcodeConfig[toHump(key)];
                allDefinition[key].isGcodeConfig = true;
            });
        }
        const fastEditSettingsKeys = getFastEditSettingsKeys(selectedToolPath);
        fastEditSettingsKeys.forEach((key) => {
            if (allDefinition[key]) {
                fastEditSettings[key] = allDefinition[key];
            }
        });
    }

    const [editingToolpath, setEditingToolpath] = useState(null);
    const [currentToolpath, setCurrentToolpath] = useState(null);
    const actions = {
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
        deleteToolPath: (toolPathId) => dispatch(editorActions.deleteToolPath(props.headType, toolPathId)),
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(props.headType, toolPathId)),
        toolPathToUp: (toolPathId) => dispatch(editorActions.toolPathToUp(props.headType, toolPathId)),
        toolPathToDown: (toolPathId) => dispatch(editorActions.toolPathToDown(props.headType, toolPathId)),
        createToolPath: () => {
            const toolpath = dispatch(editorActions.createToolPath(props.headType));
            setCurrentToolpath(toolpath);
        },
        recalculateAllToolPath: () => {
            toolPaths.forEach((toolPath) => {
                if (toolPath.status === 'warning') {
                    actions.commitGenerateToolPath(toolPath.id);
                }
            });
        },
        updateToolConfig: async (settingName, value) => {
            if (props.headType === HEAD_CNC) {
                await dispatch(cncActions.changeActiveToolListDefinition(activeToolListDefinition.definitionId, activeToolListDefinition.name));
            }
            const toolPath = selectedToolPath;
            const option = {};
            option[toHump(settingName)] = value;
            const newToolPath = {
                ...toolPath,
                gcodeConfig: {
                    ...toolPath.gcodeConfig,
                    ...option
                }
            };
            dispatch(editorActions.saveToolPath(props.headType, newToolPath));
        },
        updateGcodeConfig: (option) => {
            const toolPath = selectedToolPath;
            if (props.headType === HEAD_LASER) {
                if (!option.fixedPower) {
                    if (option.movementMode === 'greyscale-line') {
                        option.fixedPower = 50;
                    }
                    if (option.movementMode === 'greyscale-dot') {
                        option.fixedPower = 30;
                    }
                }
            }
            const newToolPath = {
                ...toolPath,
                gcodeConfig: {
                    ...toolPath.gcodeConfig,
                    ...option
                }
            };
            dispatch(editorActions.saveToolPath(props.headType, newToolPath));
        }
    };
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('Toolpath List'));
    }, []);

    const disabled = !selectedToolPathId;
    if (page === PAGE_EDITOR) {
        props.widgetActions.setDisplay(false);
    } else if (page === PAGE_PROCESS) {
        props.widgetActions.setDisplay(true);
    }
    return (
        <div className={classNames(
            styles.toolPathWrapper,
            'clearfix'
        )}
        >
            {renderExpandItem()}
            {expanded && (
                <div>
                    <div className={classNames(
                        'border-default-grey-1',
                        'border-radius-8',
                        'padding-bottom-16'
                    )}
                    >
                        <div className={classNames(
                            'height-176',
                            'align-c'
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
                                    {i18n._('Select Object to Create Toolpath')}
                                </div>
                            )}

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
                                            disabled={inProgress}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                        <div className={classNames(
                            'border-radius-bottom-8',
                            'margin-horizontal-16',
                            'clearfix'
                        )}
                        >
                            <span className={classNames(
                                'float-l',
                                'margin-vertical-8',
                            )}
                            >
                                <SvgIcon
                                    name="Delete"
                                    disabled={disabled}
                                    size={24}
                                    title={i18n._('Delete')}
                                    onClick={() => actions.deleteToolPath(selectedToolPathId)}
                                />
                            </span>
                            <div className={classNames(
                                'float-r',
                                'margin-vertical-8',
                            )}
                            >
                                <SvgIcon
                                    className={classNames(
                                        'margin-horizontal-8',
                                    )}
                                    disabled={disabled}
                                    title={i18n._('Prioritize')}
                                    onClick={() => actions.toolPathToUp(selectedToolPathId)}
                                    name="CopyNormal"
                                    size={24}
                                />
                                <SvgIcon
                                    className={classNames(
                                        'rotate180'
                                    )}
                                    disabled={disabled}
                                    title={i18n._('Deprioritize')}
                                    onClick={() => actions.toolPathToDown(selectedToolPathId)}
                                    name="CopyNormal"
                                    size={24}
                                />
                            </div>
                            <Button
                                type="primary"
                                priority="level-three"
                                width="100%"
                                onClick={actions.createToolPath}
                                disabled={inProgress || toolPathTypes.length === 0}
                            >
                                {i18n._('Create Toolpath')}
                            </Button>
                        </div>
                    </div>

                    {currentToolpath && (
                        <ToolPathConfigurations
                            toolpath={currentToolpath}
                            headType={props.headType}
                            onClose={() => setCurrentToolpath(null)}
                        />
                    )}
                    {editingToolpath && (
                        <ToolPathConfigurations
                            headType={props.headType}
                            toolpath={editingToolpath}
                            onClose={() => setEditingToolpath(null)}
                        />
                    )}

                    {selectedToolPath && selectedToolPath.headType === HEAD_CNC && activeToolListDefinition && (
                        <ToolSelector
                            toolDefinition={activeToolListDefinition}
                            toolDefinitions={toolDefinitions}
                            isModifiedDefinition={() => {
                                return !Object.entries(activeToolListDefinition.settings).every(([key, setting]) => {
                                    return fastEditSettings && fastEditSettings[key].default_value === setting.default_value;
                                });
                            }}
                            setCurrentValueAsProfile={() => {}}
                        />
                    )}
                    {selectedToolPath && (
                        <div className={classNames(
                            'border-default-grey-1',
                            'border-radius-8',
                            'margin-vertical-16',
                            'clearfix',
                            'padding-bottom-16'
                        )}
                        >
                            <div className={classNames(
                                'border-bottom-normal',
                                'border-radius-top-8',
                                'padding-horizontal-16',
                                'height-40',
                            )}
                            >
                                {i18n._('Common parameters')}
                            </div>
                            <div className="padding-horizontal-16">
                                <ToolParameters
                                    settings={fastEditSettings}
                                    updateToolConfig={actions.updateToolConfig}
                                    updateGcodeConfig={actions.updateGcodeConfig}
                                    toolPath={selectedToolPath}
                                />
                                <Anchor
                                    className={classNames(
                                        'float-r',
                                        'link-text',
                                        'height-24'
                                    )}
                                    onClick={() => setEditingToolpath(selectedToolPath)}
                                >
                                    {i18n._('More')}
                                    <SvgIcon
                                        name="ArrowRightBlue24pxNormal"
                                        size={24}
                                    />
                                </Anchor>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedToolPath && selectedToolPath.headType === HEAD_CNC && activeToolListDefinition && (
                <ToolSelector
                    toolDefinition={activeToolListDefinition}
                    toolDefinitions={toolDefinitions}
                    isModifiedDefinition={() => {
                        return !Object.entries(activeToolListDefinition.settings).every(([key, setting]) => {
                            return fastEditSettings && fastEditSettings[key].default_value === setting.default_value;
                        });
                    }}
                    setCurrentValueAsProfile={() => {}}
                />
            )}
            {selectedToolPath && (
                <ToolParameters
                    settings={fastEditSettings}
                    updateToolConfig={actions.updateToolConfig}
                    updateGcodeConfig={actions.updateGcodeConfig}
                    toolPath={selectedToolPath}
                />
            )}
            {selectedToolPath && (
                <Anchor
                    className={classNames(
                        'float-r',
                        'link-text'
                    )}
                    onClick={() => setEditingToolpath(selectedToolPath)}
                >
                    {i18n._('More')}
                </Anchor>
            )}
        </div>
    );
};
ToolPathListBox.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    headType: PropTypes.string
};
export default ToolPathListBox;
