import classNames from 'classnames';
import React from 'react';
import { Link, withRouter } from 'react-router-dom';
import i18n from '../../lib/i18n';
import styles from './styles.styl';
import { MACHINE_PATTERN } from '../../constants';

const Sidebar = (props) => {
    const { pathname = '' } = props.location;
    const { platform } = props;
    const { pattern, isConnected } = props.machineInfo;

    const show3dp = !isConnected || pattern === MACHINE_PATTERN['3DP'].value;
    const showLaser = !isConnected || pattern === MACHINE_PATTERN.LASER.value;
    const showCNC = !isConnected || pattern === MACHINE_PATTERN.CNC.value;

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
                            { [styles.active]: pathname.indexOf('/advanced') === 0 }
                        )}
                    >
                        <Link to="/advanced" title={i18n._('Advanced')}>
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
