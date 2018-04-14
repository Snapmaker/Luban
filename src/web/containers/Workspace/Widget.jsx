import PropTypes from 'prop-types';
import React from 'react';
import AxesWidget from '../../widgets/Axes';
import ConnectionWidget from '../../widgets/Connection';
import ConsoleWidget from '../../widgets/Console';
import GCodeWidget from '../../widgets/GCode';
import LaserWidget from '../../widgets/Laser';
import MacroWidget from '../../widgets/Macro';
import MarlinWidget from '../../widgets/Marlin';
import ProbeWidget from '../../widgets/Probe';
import SpindleWidget from '../../widgets/Spindle';
import VisualizerWidget from '../../widgets/Visualizer';
import WebcamWidget from '../../widgets/Webcam';

const getWidgetByName = (name) => {
    return {
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
        'webcam': WebcamWidget
    }[name] || null;
};

const Widget = (props) => {
    const { widgetId } = { ...props };

    if (typeof widgetId !== 'string') {
        return null;
    }

    // e.g. "webcam" or "webcam:d8e6352f-80a9-475f-a4f5-3e9197a48a23"
    const name = widgetId.split(':')[0];
    const Component = getWidgetByName(name);

    if (!Component) {
        return null;
    }

    return (
        <Component {...props} />
    );
};

Widget.propTypes = {
    widgetId: PropTypes.string.isRequired
};

export default Widget;
