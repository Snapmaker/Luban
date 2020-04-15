import React, { PureComponent } from 'react';
// import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';

import styles from './index.styl';

class EnclosureState extends PureComponent {
    static propTypes = {
    };

    render() {
        return (
            <div className="container-fluid px-0">
                <div className="row">
                    <div className="col-sm-6">
                        <span className={styles['connection-item-state__name']}>
                            {i18n._('Enclosure')}
                        </span>
                        <span className={classNames('float-right', styles['connection-item-state__icon'])}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: 'lime'
                                }}
                            />
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}


export default EnclosureState;
