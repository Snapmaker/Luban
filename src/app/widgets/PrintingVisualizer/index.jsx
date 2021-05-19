import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from '../styles.styl';


const PrintingVisualizerWidget = () => (
    <Widget borderless className={styles.visualizer}>
        <Widget.Content className={styles['visualizer-content-wrapper']}>
            <Visualizer />
        </Widget.Content>
    </Widget>
);

export default PrintingVisualizerWidget;
