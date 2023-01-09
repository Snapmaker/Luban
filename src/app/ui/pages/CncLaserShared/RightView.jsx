import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { PAGE_EDITOR, PAGE_PROCESS } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import i18n from '../../../lib/i18n';
import Tabs from '../../components/Tabs';
import { renderWidgetList } from '../../utils';
import ToolPathListBox from '../../widgets/CncLaserList/ToolPathList';
import CncLaserOutputWidget from '../../widgets/CncLaserOutput';
import CNCPathWidget from '../../widgets/CNCPath';
import ConnectionWidget from '../../widgets/Connection';
import ConsoleWidget from '../../widgets/Console';

import ControlWidget from '../../widgets/Control';
import EnclosureWidget from '../../widgets/Enclosure';
import GCodeWidget from '../../widgets/GCode';
import LaserParamsWidget from '../../widgets/LaserParams';
import LaserTestFocusWidget from '../../widgets/LaserTestFocus';
import MacroWidget from '../../widgets/Macro';
import MarlinWidget from '../../widgets/Marlin';
import PrintingMaterialWidget from '../../widgets/PrintingMaterial';
import PrintingOutputWidget from '../../widgets/PrintingOutput';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import PurifierWidget from '../../widgets/Purifier';
import WebcamWidget from '../../widgets/Webcam';
import WifiTransport from '../../widgets/WifiTransport';
import VisualizerWidget from '../../widgets/WorkspaceVisualizer';

const allWidgets = {
    'control': ControlWidget,
    'connection': ConnectionWidget,
    'console': ConsoleWidget,
    'gcode': GCodeWidget,
    'macro': MacroWidget,
    'macroPanel': MacroWidget,
    'purifier': PurifierWidget,
    'marlin': MarlinWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'wifi-transport': WifiTransport,
    'enclosure': EnclosureWidget,
    '3dp-material': PrintingMaterialWidget,
    '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'toolpath-list': ToolPathListBox
};

function renderRightView({ headType, dispatch, page, widgets, listActions }) {
    const widgetProps = { headType };
    return (
        <div
            className={classNames(
                'sm-flex sm-flex-direction-c height-percent-100',
                'laser-intro-edit-panel',
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
            />
        </div>
    );
}

renderRightView.propTypes = {
    headType: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    page: PropTypes.string.isRequired,
    widgets: PropTypes.array.isRequired,
    listActions: PropTypes.object.isRequired
};

export default renderRightView;
