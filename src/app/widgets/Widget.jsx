import React from 'react';
import PropTypes from 'prop-types';
import ControlWidget from './Control/index';
import DevelopAxesWidget from './DevelopAxes/index';
import ConnectionWidget from './Connection';
// import ScreenConnectionWidget from './ScreenConnection';
import ConsoleWidget from './Console';
import GCodeWidget from './GCode';
import MacroWidget from './Macro';
import MarlinWidget from './Marlin';
import VisualizerWidget from './WorkspaceVisualizer';
import WebcamWidget from './Webcam';
import LaserParamsWidget from './LaserParams';
import LaserOutputWidget from './LaserOutput';
import LaserSetBackground from './LaserSetBackground';
import LaserTestFocusWidget from './LaserTestFocus';
import CNCToolWidget from './CNCTool';
import CNCPathWidget from './CNCPath';
import CNCOutputWidget from './CNCOutput';
import PrintingMaterialWidget from './PrintingMaterial';
import PrintingConfigurationsWidget from './PrintingConfigurations';
import PrintingOutputWidget from './PrintingOutput';
import WifiTransport from './WifiTransport';
import EnclosureWidget from './Enclosure';

const getWidgetByName = (name) => {
    const Widget = {
        'control': ControlWidget,
        'axesPanel': DevelopAxesWidget,
        'connection': ConnectionWidget,
        // 'connectionPanel': ScreenConnectionWidget,
        'console': ConsoleWidget,
        'gcode': GCodeWidget,
        'macro': MacroWidget,
        'macroPanel': MacroWidget,
        'marlin': MarlinWidget,
        'visualizer': VisualizerWidget,
        'webcam': WebcamWidget,
        'wifi-transport': WifiTransport,
        'enclosure': EnclosureWidget,
        '3dp-material': PrintingMaterialWidget,
        '3dp-configurations': PrintingConfigurationsWidget,
        '3dp-output': PrintingOutputWidget,
        'laser-params': LaserParamsWidget,
        'laser-output': LaserOutputWidget,
        'laser-set-background': LaserSetBackground,
        'laser-test-focus': LaserTestFocusWidget,
        'cnc-tool': CNCToolWidget,
        'cnc-path': CNCPathWidget,
        'cnc-output': CNCOutputWidget
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
    widgetId: PropTypes.string.isRequired
};

export default Widget;
