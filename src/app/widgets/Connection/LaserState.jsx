import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';

import { MACHINE_HEAD_TYPE } from '../../constants';
import widgetStyles from '../styles.styl';
import styles from './index.styl';

class LaserState extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        laserCamera: PropTypes.bool,
        laserFocalLength: PropTypes.number.isRequired
    };


    render() {
        const { headType, laserCamera, laserFocalLength } = this.props;
        const isHeadTYpe = headType === MACHINE_HEAD_TYPE.LASER.value;
        return (
            <div>
                <div
                    style={{
                        width: '40%'
                    }}
                >
                    <div className={styles['connection-state-head']}>
                        <span className={styles['connection-state-head-name']}>
                            {i18n._('Laser')}
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
                    <div className={styles['connection-state-head']}>
                        <span className={styles['connection-state-head-name']}>
                            {i18n._('Camera')}
                        </span>
                        <span className={styles['connection-state-head-icon']}>
                            <i
                                className="fa fa-circle"
                                aria-hidden="true"
                                style={{
                                    color: laserCamera ? 'lime' : 'gold'
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div
                    className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])}
                    style={{
                        marginTop: '10px'
                    }}
                />
                <div className="row">
                    <div
                        className="col-xs-6"
                    >
                        <div className={styles['color-grey-color']}>{i18n._('Laser Focus')}</div>
                        <div>{laserFocalLength} mm</div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { laserCamera, laserFocalLength } = machine;

    return {
        laserCamera,
        laserFocalLength
    };
};


export default connect(mapStateToProps)(LaserState);
