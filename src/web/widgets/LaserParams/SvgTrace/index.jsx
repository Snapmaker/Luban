import React, { PureComponent } from 'react';
import styles from '../styles.styl';
import TracePreview from './TracePreview';
import i18n from '../../../lib/i18n';

class SvgTrace extends PureComponent {
    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Trace')}
                </div>
                <div style={{ float: 'left', textAlign: 'center' }}>
                    <TracePreview
                        width={400}
                        height={400}
                    />
                </div>
            </div>
        );
    }
}

export default SvgTrace;
