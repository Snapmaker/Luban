import React from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from '../styles.styl';


const PrintingVisualizerWidget = ({ controlInputValue, controlAxis, controlMode }) => (
    <Widget borderless className={styles.visualizer}>
        <Widget.Content className={styles['visualizer-content-wrapper']}>
            <Visualizer controlInputValue={controlInputValue} controlAxis={controlAxis} controlMode={controlMode} />
        </Widget.Content>
    </Widget>
);

PrintingVisualizerWidget.propTypes = {
    controlInputValue: PropTypes.object,
    controlAxis: PropTypes.array,
    controlMode: PropTypes.string
};
export default PrintingVisualizerWidget;
