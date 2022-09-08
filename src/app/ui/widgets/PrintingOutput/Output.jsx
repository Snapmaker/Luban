import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import path from 'path';
import classNames from 'classnames';
import { noop } from 'lodash';
// import PropTypes from 'prop-types';
import Menu from '../../components/Menu';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';

// import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import UniApi from '../../../lib/uni-api';
import { actions as printingActions } from '../../../flux/printing';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';
// import { actions as menuActions } from '../../../flux/appbar-menu';
import Thumbnail from './Thumbnail';
import { renderPopup } from '../../utils';

import Workspace from '../../pages/Workspace';
import SvgIcon from '../../components/SvgIcon';
import { STEP_STAGE } from '../../../lib/manager/ProgressManager';
import { HEAD_PRINTING } from '../../../constants';
import { logGcodeExport } from '../../../lib/gaEvent';

function useRenderWorkspace() {
    const [showWorkspace, setShowWorkspace] = useState(false);
    function renderWorkspace() {
        const onClose = () => setShowWorkspace(false);
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }
    return {
        renderWorkspace,
        setShowWorkspace
    };
}

function Output() {
    const stage = useSelector(state => state?.printing?.stage, shallowEqual);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const hasAnyModelVisible = useSelector(state => state?.printing?.modelGroup?.hasAnyModelVisible(), shallowEqual);
    const isAnyModelOverstepped = useSelector(state => state?.printing?.isAnyModelOverstepped, shallowEqual);
    const isGcodeOverstepped = useSelector(state => state?.printing?.isGcodeOverstepped, shallowEqual);
    const gcodeLine = useSelector(state => state?.printing?.gcodeLine);
    const gcodeFile = useSelector(state => state?.printing?.gcodeFile);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const defaultThumbnail = useSelector(state => state?.printing?.thumbnail);
    const leftBarOverlayVisible = useSelector(state => state?.printing?.leftBarOverlayVisible, shallowEqual);
    const outOfMemoryForRenderGcode = useSelector(state => state?.printing?.outOfMemoryForRenderGcode, shallowEqual);
    const workflowState = useSelector(state => state?.machine?.workflowState, shallowEqual);
    const series = useSelector(state => state?.machine?.series, shallowEqual);

    const dispatch = useDispatch();
    const thumbnail = useRef(null);
    const { renderWorkspace, setShowWorkspace } = useRenderWorkspace();
    const actions = {
        onToggleDisplayGcode: () => {
            if (displayedType === 'gcode') {
                dispatch(printingActions.displayModel());
            } else {
                dispatch(printingActions.displayGcode());
            }
        },
        onClickGenerateGcode: () => {
            const gcodeThumbnail = thumbnail.current.getThumbnail(series);
            dispatch(printingActions.generateGcode(gcodeThumbnail));
            dispatch(printingActions.generateGrayModeObject());
        },
        onClickLoadGcode: () => {
            if (isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            gcodeFile.thumbnail = thumbnail.current.getDataURL() || defaultThumbnail;
            dispatch(workspaceActions.renderGcodeFile(gcodeFile));
            setShowWorkspace(true);
            logGcodeExport(HEAD_PRINTING, 'workspace');
            window.scrollTo(0, 0);
        },
        onClickExportGcode: () => {
            if (isGcodeOverstepped) {
                modal({
                    title: 'Warning',
                    body: 'Generated G-code overstepped out of the cube, please modify your model and re-generate G-code.'
                });
                return;
            }
            const filename = path.basename(gcodeFile?.name);
            dispatch(projectActions.exportFile(filename, gcodeFile?.renderGcodeFileName));
            logGcodeExport(HEAD_PRINTING, 'local');
        }
    };
    useEffect(() => {
        UniApi.Event.on('appbar-menu:printing.export-gcode', actions.onClickExportGcode);
        return () => {
            UniApi.Event.off('appbar-menu:printing.export-gcode', actions.onClickExportGcode);
        };
    }, [isGcodeOverstepped, gcodeFile]);


    const isSlicing = stage === STEP_STAGE.PRINTING_SLICING;
    const menu = (
        <Menu>
            <Menu.Item
                onClick={actions.onClickLoadGcode}
                key="Load G-code to Workspace"
                disabled={workflowState === 'running' || !gcodeFile}
            >
                <div className={classNames('align-c', 'padding-vertical-4')}>
                    {i18n._('key-Printing/G-codeAction-Load G-code to Workspace')}
                </div>
            </Menu.Item>
            <Menu.Item
                key="Export G-code to File"
                disabled={!gcodeFile}
                onClick={actions.onClickExportGcode}
            >
                <div className={classNames('align-c', 'padding-vertical-4')}>
                    {i18n._('key-Printing/G-codeAction-Export G-code to File')}
                </div>
            </Menu.Item>
        </Menu>
    );

    return (
        <div className={classNames('position-fixed', 'border-radius-bottom-8', 'bottom-8', 'background-color-white', 'width-360', 'module-default-shadow', 'print-output-intro')}>
            <div className={classNames('position-re', 'margin-horizontal-16', 'margin-vertical-16')}>
                {!gcodeFile && (
                    <Button
                        type="primary"
                        priority="level-one"
                        onClick={actions.onClickGenerateGcode}
                        disabled={!hasAnyModelVisible || isSlicing || isAnyModelOverstepped || leftBarOverlayVisible}
                    >
                        {i18n._('key-Printing/G-codeAction-Generate G-code')}
                    </Button>
                )}
                {gcodeFile && !outOfMemoryForRenderGcode && (
                    <Button
                        type="default"
                        priority="level-one"
                        onClick={actions.onToggleDisplayGcode}
                        className={classNames('position-re', 'bottom-0', 'left-0')}
                    >
                        {displayedType === 'gcode' ? i18n._('key-Printing/G-codeAction-Close Preview') : i18n._('key-Printing/G-codeAction-Preview')}
                    </Button>
                )}
                {gcodeFile && (
                    <div
                        onKeyDown={noop}
                        role="button"
                        className={classNames('position-re', 'height-40', 'margin-top-10')}
                        tabIndex={0}
                    >
                        <Dropdown
                            overlay={menu}
                            trigger="click"
                        >
                            <Button
                                type="primary"
                                priority="level-one"
                                className={classNames(
                                    'position-ab',
                                    displayedType === gcodeLine ? 'display-block' : 'display-none'
                                )}
                                suffixIcon={<SvgIcon name="DropdownOpen" type={['static']} color="#D5D6D9" />}
                            >
                                {i18n._('key-Printing/G-codeAction-Export')}
                            </Button>
                        </Dropdown>
                    </div>
                )}
            </div>
            <Thumbnail
                ref={thumbnail}
                modelGroup={modelGroup}
            />
            {renderWorkspace()}
        </div>
    );
}

export default React.memo(Output);
