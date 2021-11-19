import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { noop } from 'lodash';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as editorActions } from '../../../flux/editor';
import { actions as projectActions } from '../../../flux/project';
import {
    DISPLAYED_TYPE_TOOLPATH, PAGE_EDITOR, PAGE_PROCESS
} from '../../../constants';

import modal from '../../../lib/modal';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import { renderPopup } from '../../utils';
import styles from './styles.styl';
import Workspace from '../../pages/Workspace';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import Thumbnail from '../CncLaserShared/Thumbnail';
import SvgIcon from '../../components/SvgIcon';

const Output = ({ headType }) => {
    const displayedType = useSelector(state => state[headType]?.displayedType);
    const gcodeFile = useSelector(state => state[headType]?.gcodeFile);
    const needToPreview = useSelector(state => state[headType]?.needToPreview);
    const page = useSelector(state => state[headType]?.page);
    const previewFailed = useSelector(state => state[headType]?.previewFailed);
    const shouldGenerateGcodeCounter = useSelector(state => state[headType]?.shouldGenerateGcodeCounter);
    const modelGroup = useSelector(state => state[headType]?.modelGroup);
    const hasModel = useSelector(state => state[headType]?.modelGroup.hasModel(), shallowEqual);
    const toolPathGroup = useSelector(state => state[headType]?.toolPathGroup);
    const workflowState = useSelector(state => state.machine?.workflowState);
    const isGcodeGenerating = useSelector(state => state[headType]?.isGcodeGenerating);

    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);

    const dispatch = useDispatch();
    const thumbnail = useRef();

    const actions = {
        switchToEditPage: () => {
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                dispatch(editorActions.showModelGroupObject(headType));
            } else {
                dispatch(editorActions.showToolPathGroupObject(headType));
            }
        },
        switchToProcess: () => {
            dispatch(editorActions.switchToPage(headType, PAGE_PROCESS));
        },
        onGenerateThumbnail: () => {
            dispatch(editorActions.setThumbnail(headType, thumbnail?.current?.getThumbnail()));
        },
        onLoadGcode: async () => {
            if (gcodeFile === null) {
                return;
            }
            await dispatch(workspaceActions.renderGcodeFile(gcodeFile));
            setShowWorkspace(true);
            window.scrollTo(0, 0);
        },
        onExport: () => {
            if (gcodeFile === null) {
                return;
            }
            dispatch(projectActions.exportFile(gcodeFile.uploadName, gcodeFile.renderGcodeFileName));
        },
        onProcess: () => {
            dispatch(editorActions.createToolPath(headType));
        },
        onSimulation: () => {
            dispatch(editorActions.commitGenerateViewPath(headType));
        },
        showToolPathObject: () => {
            dispatch(editorActions.showToolPathGroupObject(headType));
        },
        preview: async () => {
            if (needToPreview) {
                await dispatch(editorActions.preview(headType));
            } else {
                dispatch(editorActions.showToolPathGroupObject(headType));
            }
        },
        setAutoPreview: (enable) => {
            dispatch(editorActions.setAutoPreview(headType, enable));
        },
        showAndHideToolPathObject: () => {
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                dispatch(editorActions.showModelGroupObject(headType));
            } else {
                dispatch(editorActions.showToolPathGroupObject(headType));
            }
        },
        handleMouseOver: () => {
            setShowExportOptions(true);
        },
        handleMouseOut: () => {
            setShowExportOptions(false);
        }
    };

    useEffect(() => {
        UniApi.Event.on('appbar-menu:cnc-laser.export-gcode', actions.onExport);
        return () => {
            UniApi.Event.off('appbar-menu:cnc-laser.export-gcode', actions.onExport);
        };
    }, [gcodeFile]);
    useEffect(() => {
        if (previewFailed) {
            modal({
                title: i18n._('key-CncLaser/G-codeAction-Failed to preview'),
                body: i18n._('key-CncLaser/G-codeAction-Failed to preview, please modify parameters and try again.')
            });
        }
    }, [previewFailed]);
    useEffect(() => {
        actions.onGenerateThumbnail();
        dispatch(editorActions.commitGenerateGcode(headType));
    }, [shouldGenerateGcodeCounter]);


    function renderWorkspace() {
        const onClose = () => setShowWorkspace(false);
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    const disableExport = toolPathGroup.toolPaths.every(toolPath => {
        if (toolPath.visible === false) {
            return true;
        } else {
            const toolPathRelatedModels = modelGroup.models.filter(model => toolPath.modelIDs.includes(model.modelID));
            return toolPathRelatedModels.every(model => model.visible === false);
        }
    });

    const isEditor = page === PAGE_EDITOR;
    const hasToolPathModel = (toolPathGroup.toolPaths.length > 0);
    const toolPathRelatedModelInvisible = toolPathGroup.toolPaths.every(toolPath => {
        const toolPathRelatedModels = modelGroup.models.filter(model => toolPath.modelIDs.includes(model.modelID));
        return toolPathRelatedModels.every(model => model.visible === false);
    });
    const disablePreview = toolPathGroup.toolPaths.every(item => item.visible === false) || toolPathRelatedModelInvisible;

    const menu = (
        <Menu>
            <Menu.Item
                onClick={actions.onLoadGcode}
                disabled={disableExport || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
            >
                <div className={classNames('align-c', 'padding-vertical-4')}>
                    {i18n._('key-CncLaser/G-codeAction-Load G-code to Workspace')}
                </div>
            </Menu.Item>
            <Menu.Item
                disabled={disableExport || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                onClick={actions.onExport}
            >
                <div className={classNames('align-c', 'padding-vertical-4')}>
                    {i18n._('key-CncLaser/G-codeAction-Export G-code to File')}
                </div>
            </Menu.Item>
        </Menu>
    );

    return (
        <div className={classNames('position-fixed', 'border-radius-bottom-8', 'bottom-8', 'background-color-white', styles['output-wrapper'], `${headType}-preview-export-intro-part`)}>
            <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                {isEditor && (
                    <Button
                        type="primary"
                        priority="level-one"
                        onClick={actions.switchToProcess}
                        disabled={!hasModel ?? false}
                    >
                        {i18n._('key-CncLaser/G-codeAction-Next')}
                    </Button>
                )}
                {(!isEditor && needToPreview) && (
                    <Button
                        type="primary"
                        priority="level-one"
                        onClick={actions.preview}
                        disabled={(!hasToolPathModel ?? false) || disablePreview}
                    >
                        {i18n._('key-CncLaser/G-codeAction-Generate G-code and Preview')}
                    </Button>
                )}
                {!isEditor && !needToPreview && displayedType === DISPLAYED_TYPE_TOOLPATH && !showExportOptions && (
                    <Button
                        type="default"
                        priority="level-one"
                        onClick={() => {
                            actions.switchToEditPage();
                            actions.handleMouseOut();
                        }}
                        className={classNames('position-re', 'bottom-0', 'left-0')}
                    >
                        {i18n._('key-CncLaser/G-codeAction-Close Preview')}
                    </Button>
                )}
                {!isEditor && !needToPreview && displayedType !== DISPLAYED_TYPE_TOOLPATH && !showExportOptions && (
                    <Button
                        type="default"
                        priority="level-one"
                        onClick={() => {
                            actions.showToolPathObject();
                        }}
                        className={classNames('position-re', 'bottom-0', 'left-0')}
                    >
                        {i18n._('key-CncLaser/G-codeAction-Preview')}
                    </Button>
                )}
                {!isEditor && !needToPreview && (
                    <div
                        onKeyDown={noop}
                        role="button"
                        tabIndex={0}
                        className={classNames('position-re', 'height-40', 'margin-top-10')}
                    >
                        <Dropdown
                            overlay={menu}
                            trigger="click"
                        >
                            <Button
                                type="primary"
                                priority="level-one"
                                disabled={disableExport || !hasModel || workflowState === 'running' || isGcodeGenerating || gcodeFile === null}
                                className={classNames(
                                    'position-ab',
                                    // 'bottom-ne-8',
                                    // 'margin-top-10',
                                    displayedType === DISPLAYED_TYPE_TOOLPATH ? 'display-block' : 'display-none'
                                )}
                                suffixIcon={<SvgIcon name="DropdownOpen" type={['static']} color="#d5d6d9" />}
                            >
                                {i18n._('key-CncLaser/G-codeAction-Export')}
                            </Button>
                        </Dropdown>
                    </div>
                )}

            </div>
            <Thumbnail
                ref={thumbnail}
                myRef={thumbnail}
                toolPathGroup={toolPathGroup}
            />
            {renderWorkspace()}
        </div>
    );
};

Output.propTypes = {
    headType: PropTypes.string
};

export default Output;
