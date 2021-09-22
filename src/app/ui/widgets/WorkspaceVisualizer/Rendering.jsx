import React from 'react';
import i18n from '../../../lib/i18n';
import styles from './loader.styl';

export default () => (
    <div className={styles.loader}>
        <div className={styles.loaderIcon}>
            <i className="fa fa-cube fa-spin" />
        </div>
        <div className={styles.loaderText}>
            {i18n._('key_ui/widgets/WorkspaceVisualizer/Rendering_3D rendering...')}
        </div>
    </div>
);
