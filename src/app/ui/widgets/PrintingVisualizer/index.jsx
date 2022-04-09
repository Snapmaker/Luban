import React from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from '../styles.styl';


const PrintingVisualizerWidget = ({ rotateInputValue, rotateAxis }) => (
    <Widget borderless className={styles.visualizer}>
        <Widget.Content className={styles['visualizer-content-wrapper']}>
            <Visualizer rotateInputValue={rotateInputValue} rotateAxis={rotateAxis} />
        </Widget.Content>
    </Widget>
);

PrintingVisualizerWidget.propTypes = {
    rotateInputValue: PropTypes.number,
    rotateAxis: PropTypes.string
};
export default PrintingVisualizerWidget;
