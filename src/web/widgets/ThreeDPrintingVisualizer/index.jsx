import React from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';


const ThreeDPrintingVisualizerWidget = () => (
    <Widget borderless>
        <Widget.Content
            style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            }}
        >
            <Visualizer />
        </Widget.Content>
    </Widget>
);

ThreeDPrintingVisualizerWidget.propTypes = {
    widgetId: PropTypes.string.isRequired
};

export default ThreeDPrintingVisualizerWidget;
