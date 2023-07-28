import { Machine } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { PAGE_EDITOR, PAGE_PROCESS } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import Tabs from '../../components/Tabs';
import { renderWidgetList } from '../../utils';
import CNCPathWidget from '../../widgets/CNCPath';
import ToolPathListBox from '../../widgets/CncLaserList/ToolPathList';
import CncLaserOutputWidget from '../../widgets/CncLaserOutput';
import LaserParamsWidget from '../../widgets/LaserParams';
import LaserTestFocusWidget from '../../widgets/LaserTestFocus';
import VisualizerWidget from '../../widgets/WorkspaceVisualizer';
import { LoadGcodeOptions } from '../../widgets/CncLaserOutput/Output';
import { SnapmakerRayMachine } from '../../../machines';

const allWidgets = {
    'visualizer': VisualizerWidget,
    'laser-params': LaserParamsWidget,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'toolpath-list': ToolPathListBox,
};

interface ProjectRightViewProps {
    headType: 'laser' | 'cnc';
    page: string;
    widgets: string[];
    listActions: {
        [actionName: string]: () => void;
    }
}

const RenderProjectRightView: React.FC<ProjectRightViewProps> = ({ headType, page, widgets, listActions }) => {
    const activeMachine: Machine | null = useSelector((state: RootState) => state.machine.activeMachine);

    const dispatch = useDispatch();
    const widgetProps = { headType };

    const loadGcodeOptions: LoadGcodeOptions = useMemo(() => {
        return {
            renderImmediately: activeMachine?.identifier === SnapmakerRayMachine.identifier,
        };
    }, [activeMachine?.identifier]);

    return (
        <div
            className={classNames(
                'sm-flex sm-flex-direction-c height-percent-100',
                'laser-intro-edit-panel', // for starter guide
            )}
        >
            <div className="background-color-white border-radius-8 margin-bottom-8 sm-flex-width overflow-y-auto">
                <Tabs
                    options={[
                        {
                            tab: i18n._('key-CncLaser/RightSidebar-Edit'),
                            key: PAGE_EDITOR
                        },
                        {
                            tab: i18n._('key-CncLaser/RightSidebar-Process'),
                            key: PAGE_PROCESS
                        }
                    ]}
                    activeKey={page}
                    onChange={(key) => {
                        dispatch(editorActions.switchToPage(headType, key));
                        if (key === 'editor') {
                            dispatch(editorActions.showModelGroupObject(headType));
                        }
                    }}
                />
                {renderWidgetList(headType, 'default', widgets, allWidgets, listActions, widgetProps)}
            </div>
            <CncLaserOutputWidget
                headType={headType}
                loadGcodeOptions={loadGcodeOptions}
            />
        </div>
    );
};

export default RenderProjectRightView;
