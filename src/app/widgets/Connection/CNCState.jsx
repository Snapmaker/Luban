import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';

import { MACHINE_HEAD_TYPE } from '../../constants';
import styles from './index.styl';

class CNCState extends PureComponent {
    static propTypes = {
        headType: PropTypes.string
    };

    render() {
        const { headType } = this.props;
        const isHeadTYpe = headType === MACHINE_HEAD_TYPE.CNC.value;
        return (
            <div>
                <div
                    style={{
                        width: '40%'
                    }}
                >
                    <div className={styles['connection-state-head']}>
                        <span className={styles['connection-state-head-name']}>
                            {i18n._('CNC')}
                        </span>
                        <span className={styles['connection-state-head-icon']}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: isHeadTYpe ? 'lime' : 'gold'
                                }}
                            />
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}


export default CNCState;
