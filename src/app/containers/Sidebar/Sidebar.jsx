import classNames from 'classnames';
import React from 'react';
import { Link, withRouter } from 'react-router-dom';
import i18n from '../../lib/i18n';
import styles from './styles.styl';
import { MACHINE_HEAD_TYPE } from '../../constants';

const Sidebar = (props) => {
    const { pathname = '' } = props.location;
    const { platform } = props;
    const { headType, isConnected } = props.machineInfo;

    const show3dp = !isConnected || headType === MACHINE_HEAD_TYPE['3DP'].value;
    const showLaser = !isConnected || headType === MACHINE_HEAD_TYPE.LASER.value;
    const showCNC = !isConnected || headType === MACHINE_HEAD_TYPE.CNC.value;

    return (
        <div className={styles.sidebar} id="sidebar">
            <nav className={styles.navbar}>
                <ul className={styles.nav}>
                    <li
                        className={classNames(
                            'text-center',
                            { [styles.active]: pathname.indexOf('/workspace') === 0 }
                        )}
                    >
                        <Link to="/workspace" title={i18n._('Workspace')}>
                            <i
                                className={classNames(
                                    styles.icon,
                                    styles.iconInvert,
                                    styles.iconXyz
                                )}
                            />
                        </Link>
                    </li>
                    {platform !== 'unknown' && show3dp && (
                        <li
                            className={classNames(
                                'text-center',
                                { [styles.active]: pathname.indexOf('/3dp') === 0 }
                            )}
                        >
                            <Link to="/3dp" title={i18n._('3D Printing G-code Generator')}>
                                <i
                                    className={classNames(
                                        styles.icon,
                                        styles.iconInvert,
                                        styles['icon-3dp']
                                    )}
                                />
                            </Link>
                        </li>
                    )}
                    {showLaser && (
                        <li
                            className={classNames(
                                'text-center',
                                { [styles.active]: pathname.indexOf('/laser') === 0 }
                            )}
                        >
                            <Link to="/laser" title={i18n._('Laser G-code Generator')}>
                                <i
                                    className={classNames(
                                        styles.icon,
                                        styles.iconInvert,
                                        styles.iconLaser
                                    )}
                                />
                            </Link>
                        </li>
                    )}
                    {showCNC && (
                        <li
                            className={classNames(
                                'text-center',
                                { [styles.active]: pathname.indexOf('/cnc') === 0 }
                            )}
                        >
                            <Link to="/cnc" title={i18n._('CNC G-code Generator')}>
                                <i
                                    className={classNames(
                                        styles.icon,
                                        styles.iconInvert,
                                        styles.iconCnc
                                    )}
                                />
                            </Link>
                        </li>
                    )}
                    <li
                        className={classNames(
                            'text-center',
                            { [styles.active]: pathname.indexOf('/developTools') === 0 }
                        )}
                        style={{
                            display: 'none'
                        }}
                    >
                        <Link to="/developTools" title={i18n._('DevelopTools')}>
                            <i
                                className={classNames(
                                    styles.icon,
                                    styles.iconInvert,
                                    styles['icon-3dp']
                                )}
                            />
                        </Link>
                    </li>
                </ul>
                <ul className={styles.navFixedBottom}>
                    <li
                        className={classNames(
                            'text-center',
                            { [styles.active]: pathname.indexOf('/caselibrary') === 0 }
                        )}
                    >
                        <Link to="/caselibrary" title={i18n._('Case Library')}>
                            <i
                                className={classNames(
                                    styles.icon,
                                    styles.iconInvert,
                                    styles.iconLibrary
                                )}
                            />
                        </Link>
                    </li>
                    <li
                        className={classNames(
                            'text-center',
                            { [styles.active]: pathname.indexOf('/settings') === 0 }
                        )}
                    >
                        <Link to="/settings" title={i18n._('Settings')}>
                            <i
                                className={classNames(
                                    styles.icon,
                                    styles.iconInvert,
                                    styles.iconGear
                                )}
                            />
                        </Link>
                    </li>
                </ul>
            </nav>
        </div>
    );
};

Sidebar.propTypes = {
    ...withRouter.propTypes
};

export default withRouter(Sidebar);
