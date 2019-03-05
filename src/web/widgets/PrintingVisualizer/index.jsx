import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from '../styles.styl';


const PrintingVisualizerWidget = () => (
    <Widget borderless>
        <Widget.Content className={styles['visualizer-content']}>
            <Visualizer />
        </Widget.Content>
    </Widget>
);

export default PrintingVisualizerWidget;
