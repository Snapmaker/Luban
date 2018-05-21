import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';


class ThreeDPrintingVisualizerWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        state: PropTypes.object
    };

    render() {
        return (
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
    }
}

export default ThreeDPrintingVisualizerWidget;
