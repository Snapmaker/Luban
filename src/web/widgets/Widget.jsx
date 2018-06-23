import React from 'react';
import PropTypes from 'prop-types';
import AxesWidget from './Axes/index';
import ConnectionWidget from './Connection';
import ConsoleWidget from './Console';
import GCodeWidget from './GCode';
import LaserWidget from './Laser';
import MacroWidget from './Macro';
import MarlinWidget from './Marlin';
import ProbeWidget from './Probe';
import SpindleWidget from './Spindle';
import VisualizerWidget from './Visualizer';
import WebcamWidget from './Webcam';
import LaserParams from './LaserParams';
import LaserGenerateGcode from './LaserGenerateGcode';
import CNCTool from './CNCTool';
import CNCPath from './CNCPath';
import CNCGenerateGcode from './CNCGenerateGcode';
import ThreeDPrintingMaterial from './ThreeDPrintingMaterial';
import ThreeDPrintingConfigurations from './ThreeDPrintingConfigurations';
import ThreeDPrintingOutput from './ThreeDPrintingOutput';
import LaserTestFocuse from './LaserTestFocuse';

const getWidgetByName = (name) => {
    const Widget = {
        'axes': AxesWidget,
        'connection': ConnectionWidget,
        'console': ConsoleWidget,
        'gcode': GCodeWidget,
        'laser': LaserWidget,
        'macro': MacroWidget,
        'marlin': MarlinWidget,
        'probe': ProbeWidget,
        'spindle': SpindleWidget,
        'visualizer': VisualizerWidget,
        'webcam': WebcamWidget,
        'laser-params': LaserParams,
        'laser-generate-gcode': LaserGenerateGcode,
        'cnc-tool': CNCTool,
        'cnc-path': CNCPath,
        'cnc-generate-gcode': CNCGenerateGcode,
        '3dp-material': ThreeDPrintingMaterial,
        '3dp-configurations': ThreeDPrintingConfigurations,
        '3dp-output': ThreeDPrintingOutput,
        'laser-test-focuse': LaserTestFocuse
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
