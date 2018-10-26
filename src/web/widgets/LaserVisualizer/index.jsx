import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import PrimaryToolbar from '../VisualizerToolbar/PrimaryToolbar';
import SecondaryToolbar from '../VisualizerToolbar/SecondaryToolbar';
import styles from '../styles.styl';

const MODE = 'laser';

const LaserVisualizerWidget = () => (
    <Widget borderless>
        <Widget.Header className={styles.widgetHeader}>
            <PrimaryToolbar mode={MODE} />
        </Widget.Header>
        <Widget.Content className={styles.visualizerContent}>
            <Visualizer mode={MODE} />
        </Widget.Content>
        <Widget.Footer className={styles.visualizerFooter}>
            <SecondaryToolbar mode={MODE} />
        </Widget.Footer>
    </Widget>
);

export default LaserVisualizerWidget;

