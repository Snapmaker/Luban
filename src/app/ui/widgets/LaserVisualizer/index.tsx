import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import styles from './styles.styl';
import { PageMode } from '../../pages/PageMode';

interface LaserVisualizerWidgetProps {
    pageMode: PageMode;
    setPageMode: (mode: PageMode) => void;
}

const LaserVisualizerWidget : React.FC<LaserVisualizerWidgetProps> = (props) => {
    const { pageMode, setPageMode } = props;

    return (
        <Widget borderless>
            <Widget.Content
                className={styles['visualizer-content-wrapper']}
                style={{
                    padding: 0,
                    position: 'relative',
                }}
            >
                <Visualizer
                    pageMode={pageMode}
                    setPageMode={setPageMode}
                />
            </Widget.Content>
        </Widget>
    );
};

export default LaserVisualizerWidget;
