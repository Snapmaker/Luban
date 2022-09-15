import React from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from '../styles.styl';


const PrintingVisualizerWidget = ({ simplifying, setSimplifying }) => (
    <Widget borderless className={styles.visualizer}>
        <Widget.Content className={styles['visualizer-content-wrapper']}>
            <Visualizer
                simplifying={simplifying}
                setSimplifying={setSimplifying}
            />
        </Widget.Content>
    </Widget>
);

PrintingVisualizerWidget.propTypes = {
    simplifying: PropTypes.bool,
    setSimplifying: PropTypes.func
};
export default PrintingVisualizerWidget;
