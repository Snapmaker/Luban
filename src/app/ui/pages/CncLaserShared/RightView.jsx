import React from 'react';
import PropTypes from 'prop-types';
import Tabs from '../../components/Tabs';
import i18n from '../../../lib/i18n';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { renderWidgetList } from '../../utils';

import ControlWidget from '../../widgets/Control';
import ConnectionWidget from '../../widgets/Connection';
import ConsoleWidget from '../../widgets/Console';
import GCodeWidget from '../../widgets/GCode';
import MacroWidget from '../../widgets/Macro';
import PurifierWidget from '../../widgets/Purifier';
import MarlinWidget from '../../widgets/Marlin';
import VisualizerWidget from '../../widgets/WorkspaceVisualizer';
import WebcamWidget from '../../widgets/Webcam';
import LaserParamsWidget from '../../widgets/LaserParams';
import LaserTestFocusWidget from '../../widgets/LaserTestFocus';
import CNCPathWidget from '../../widgets/CNCPath';
import CncLaserOutputWidget from '../../widgets/CncLaserOutput';
import PrintingMaterialWidget from '../../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../../widgets/PrintingOutput';
import WifiTransport from '../../widgets/WifiTransport';
import EnclosureWidget from '../../widgets/Enclosure';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import ToolPathListBox from '../../widgets/CncLaserList/ToolPathList';

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
    '3dp-configurations': PrintingConfigurationsWidget,
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
        <div className="laser-intro-edit-panel">
            <Tabs
                options={[
                    {
                        tab: i18n._('Edit'),
                        key: PAGE_EDITOR
                    },
                    {
                        tab: i18n._('Process'),
                        key: PAGE_PROCESS
                    }
                ]}
                activeKey={page}
                onChange={(key) => {
                    dispatch(editorActions.switchToPage(headType, key));
                    if (key === headType) {
                        dispatch(editorActions.showModelGroupObject(headType));
                    }
                }}
            />
            {renderWidgetList(headType, 'default', widgets, allWidgets, listActions, widgetProps)}
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
