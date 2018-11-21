import React from 'react';
import PropTypes from 'prop-types';
import AxesWidget from './Axes/index';
import ConnectionWidget from './Connection';
import ConsoleWidget from './Console';
import GCodeWidget from './GCode';
import LaserWidget from './Laser';
import MarlinWidget from './Marlin';
import VisualizerWidget from './WorkspaceVisualizer';
import WebcamWidget from './Webcam';
import LaserParamsWidget from './LaserParams';
import LaserGenerateGcodeWidget from './LaserGenerateGcode';
import LaserOutputWidget from './LaserOutput';
import LaserTestFocusWidget from './LaserTestFocus';
import CNCToolWidget from './CNCTool';
import CNCPathWidget from './CNCPath';
import CNCGenerateGcodeWidget from './CNCGenerateGcode';
import CNCOutputWidget from './CNCOutput';
import ThreeDPrintingMaterial from './ThreeDPrintingMaterial';
import ThreeDPrintingConfigurationsWidget from './ThreeDPrintingConfigurations';
import ThreeDPrintingOutputWidget from './ThreeDPrintingOutput';


const getWidgetByName = (name) => {
    const Widget = {
        'axes': AxesWidget,
        'connection': ConnectionWidget,
        'console': ConsoleWidget,
        'gcode': GCodeWidget,
        'laser': LaserWidget,
        'marlin': MarlinWidget,
        'visualizer': VisualizerWidget,
        'webcam': WebcamWidget,
        '3dp-material': ThreeDPrintingMaterial,
        '3dp-configurations': ThreeDPrintingConfigurationsWidget,
        '3dp-output': ThreeDPrintingOutputWidget,
        'laser-params': LaserParamsWidget,
        'laser-generate-gcode': LaserGenerateGcodeWidget,
        'laser-output': LaserOutputWidget,
        'laser-test-focus': LaserTestFocusWidget,
        'cnc-tool': CNCToolWidget,
        'cnc-path': CNCPathWidget,
        'cnc-generate-gcode': CNCGenerateGcodeWidget,
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
