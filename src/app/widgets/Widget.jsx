import React from 'react';
import PropTypes from 'prop-types';
import ControlWidget from './Control/index';
import DevelopAxesWidget from './DevelopAxes/index';
import ConnectionWidget from './Connection';
import ConsoleWidget from './Console';
import GCodeWidget from './GCode';
import MacroWidget from './Macro';
import PurifierWidget from './Purifier';
import MarlinWidget from './Marlin';
import VisualizerWidget from './WorkspaceVisualizer';
import WebcamWidget from './Webcam';
import LaserParamsWidget from './LaserParams';
import LaserSetBackground from './LaserSetBackground';
import LaserTestFocusWidget from './LaserTestFocus';
import CNCPathWidget from './CNCPath';
import CncLaserOutputWidget from './CncLaserOutput';
import PrintingMaterialWidget from './PrintingMaterial';
import PrintingConfigurationsWidget from './PrintingConfigurations';
import PrintingOutputWidget from './PrintingOutput';
import WifiTransport from './WifiTransport';
import EnclosureWidget from './Enclosure';
import CncLaserObjectList from './CncLaserList';
import PrintingObjectList from './PrintingObjectList';
import JobType from './JobType';
import CreateToolPath from './CncLaserToolPath';

const getWidgetByName = (name) => {
    const Widget = {
        'control': ControlWidget,
        'axesPanel': DevelopAxesWidget,
        'connection': ConnectionWidget,
        'console': ConsoleWidget,
        'gcode': GCodeWidget,
        'macro': MacroWidget,
        'macroPanel': MacroWidget,
        'purifier': PurifierWidget,
        'marlin': MarlinWidget,
        'visualizer': VisualizerWidget,
        'webcam': WebcamWidget,
        'wifi-transport': WifiTransport,
        'enclosure': EnclosureWidget,
        '3dp-object-list': PrintingObjectList,
        '3dp-material': PrintingMaterialWidget,
        '3dp-configurations': PrintingConfigurationsWidget,
        '3dp-output': PrintingOutputWidget,
        'laser-params': LaserParamsWidget,
        'laser-output': CncLaserOutputWidget,
        'laser-set-background': LaserSetBackground,
        'laser-test-focus': LaserTestFocusWidget,
        'cnc-path': CNCPathWidget,
        'cnc-output': CncLaserOutputWidget,
        'cnc-laser-object-list': CncLaserObjectList,
        'job-type': JobType,
        'create-toolpath': CreateToolPath
    }[name];
    if (!Widget) {
        throw new Error(`Unknown Widget ${name}`);
    }
    return Widget;
};

/**
 * Widget Wrapper for getting Widget from widget id.
 */
const Widget = (props) => {
    const { widgetId } = props;

    if (typeof widgetId !== 'string') {
        return null;
    }

    const name = widgetId.split(':')[0];
    const Component = getWidgetByName(name);

    return (
        <Component {...props} />
    );
};

Widget.propTypes = {
    widgetId: PropTypes.string.isRequired,
    headType: PropTypes.string
};

export default Widget;
