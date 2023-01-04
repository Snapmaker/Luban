import PropTypes from 'prop-types';
import React from 'react';

import Widget from '../../components/Widget';
import styles from '../styles.styl';
import Visualizer from './Visualizer';


const PrintingVisualizerWidget = (props) => (
    <Widget borderless className={styles.visualizer}>
        <Widget.Content
            className={styles['visualizer-content-wrapper']}
            style={{
                padding: 0,
                position: 'relative',
            }}
        >
            <Visualizer
                pageMode={props.pageMode}
                setPageMode={props.setPageMode}
            />
        </Widget.Content>
    </Widget>
);

PrintingVisualizerWidget.propTypes = {
    pageMode: PropTypes.string.isRequired,
    setPageMode: PropTypes.func.isRequired,
};

export default PrintingVisualizerWidget;
