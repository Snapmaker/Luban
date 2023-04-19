import React from 'react';

import type { PageMode } from '../../pages/PageMode';

import SceneView from './SceneView';
import styles from './styles.styl';

interface SceneWidgetProps {
    pageMode: PageMode;
    setPageMode: (mode: PageMode) => void;
}

/**
 * Widget for 3D Scene.
 */
const SceneWidget: React.FC<SceneWidgetProps> = (props) => {
    const { pageMode, setPageMode } = props;

    return (
        <div className={styles['widget-container']}>
            <SceneView
                pageMode={pageMode}
                setPageMode={setPageMode}
            />
        </div>
    );
};

export default SceneWidget;
