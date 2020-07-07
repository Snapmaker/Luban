import React from 'react';
import PropTypes from 'prop-types';
import loadable from '../lib/loadable';

import ConnectionWidget from './Connection';


// const ConnectionWidget = loadable(() => import('./Connection'));
const ConsoleWidget = loadable(() => import('./Console'));
const LaserTestFocusWidget = loadable(() => import('./LaserTestFocus'));
const MarlinWidget = loadable(() => import('./Marlin'));
const ControlWidget = loadable(() => import('./Control/index'));
const DevelopAxesWidget = loadable(() => import('./DevelopAxes/index'));
const GCodeWidget = loadable(() => import('./GCode'));
const MacroWidget = loadable(() => import('./Macro'));
const VisualizerWidget = loadable(() => import('./WorkspaceVisualizer'));
const WebcamWidget = loadable(() => import('./Webcam'));
const LaserParamsWidget = loadable(() => import('./LaserParams'));
const LaserOutputWidget = loadable(() => import('./LaserOutput'));
const LaserSetBackground = loadable(() => import('./LaserSetBackground'));
const CNCToolWidget = loadable(() => import('./CNCTool'));
const CNCPathWidget = loadable(() => import('./CNCPath'));
const CNCOutputWidget = loadable(() => import('./CNCOutput'));
const PrintingMaterialWidget = loadable(() => import('./PrintingMaterial'));
const PrintingConfigurationsWidget = loadable(() => import('./PrintingConfigurations'));
const PrintingOutputWidget = loadable(() => import('./PrintingOutput'));
const WifiTransport = loadable(() => import('./WifiTransport'));
const EnclosureWidget = loadable(() => import('./Enclosure'));
const CncLaserObjectList = loadable(() => import('./CncLaserObjectList'));

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
        'cnc-output': CNCOutputWidget,
        'cnc-laser-object-list': CncLaserObjectList
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
