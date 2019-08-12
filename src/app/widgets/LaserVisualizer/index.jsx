import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from './styles.styl';


const LaserVisualizerWidget = () => (
    <Widget borderless>
        <Widget.Content className={styles['widget-content']}>
            <Visualizer />
        </Widget.Content>
    </Widget>
);

export default LaserVisualizerWidget;
