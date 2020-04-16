import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';

import { MACHINE_HEAD_TYPE } from '../../constants';
import styles from './index.styl';

class CNCState extends PureComponent {
    static propTypes = {
        headType: PropTypes.string
    };

    render() {
        const { headType } = this.props;
        const isCNC = headType === MACHINE_HEAD_TYPE.CNC.value;

        return (
            <div className="container-fluid px-0">
                <div className="row">
                    <div className="col-sm-6">
                        <span className={styles['connection-item-state__name']}>
                            {i18n._('CNC')}
                        </span>
                        <span className={classNames('float-right', styles['connection-item-state__icon'])}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: isCNC ? 'lime' : 'gold'
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
