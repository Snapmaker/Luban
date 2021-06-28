import classNames from 'classnames';
import React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
// import PropTypes from 'prop-types';
// import { connect } from 'react-redux';
import settings from '../../../../config/settings';
import i18n from '../../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import Space from '../../../components/Space';
import styles from './index.styl';
import UniApi from '../../../../lib/uni-api';
import { actions as machineActions } from '../../../../flux/machine';

function SoftwareUpdate() {
    const isDownloading = useSelector(state => state?.machine?.isDownloading, shallowEqual);
    const shouldCheckForUpdate = useSelector(state => state?.machine?.shouldCheckForUpdate, shallowEqual);
    const autoupdateMessage = useSelector(state => state?.machine?.autoupdateMessage, shallowEqual);
    const dispatch = useDispatch();
    const updateShouldCheckForUpdate = (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate));
    // static propTypes = {
    // state: PropTypes.object,
    // stateChanged: PropTypes.bool,
    // shouldCheckForUpdate: PropTypes.bool,
    // isDownloading: PropTypes.bool,
    // autoupdateMessage: PropTypes.string,
    // updateShouldCheckForUpdate: PropTypes.func.isRequired,
    // actions: PropTypes.object
    // };

    const actions = {
        handleCheckForUpdate: () => {
            if (isDownloading) {
                UniApi.Update.downloadHasStarted();
            } else {
                UniApi.Update.checkForUpdate();
            }
        }
    };

    return (
        <div style={{ marginBottom: '55px' }}>
            {/* <About /> */}

            <form>
                <div className={styles['form-container']}>
                    <div className={styles['form-group']}>
                        <div className={styles['autoupdate-wrapper']}>
                            <div>
                                <div className={styles['lu-logo-container']}>
                                    <i className={styles.logo} />
                                </div>
                                <div className={styles['lu-version']}>
                                    <div className={styles['product-details']}>
                                        <div className={styles['about-product-name']}>
                                            {`Snapmaker Luban ${settings.version}`}
                                        </div>
                                        <div className={styles['about-product-description']}>
                                            {i18n._('A web-based interface for Snapmaker which is able to do 3D Printing, laser engraving and CNC carving.')}
                                            <Space width={8} />
                                            <Anchor
                                                className={styles['learn-more']}
                                                href="https://snapmaker.com/support"
                                                target="_blank"
                                            >
                                                {i18n._('Learn more')}
                                                <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
                                            </Anchor>
                                        </div>
                                    </div>
                                    <div className={styles['autoupdate-auto']}>
                                        <input
                                            type="checkbox"
                                            className={styles['autoupdate-checkbox']}
                                            checked={shouldCheckForUpdate}
                                            onChange={(event) => { updateShouldCheckForUpdate(event.target.checked); }}
                                        />
                                        <span className={styles['autoupdate-text']}>
                                            {i18n._('Automatically check for updates')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles['autoupdate-update']}>
                                <button
                                    className={classNames(
                                        'btn',
                                        'btn-outline-secondary',
                                        styles['autoupdate-button'],
                                    )}
                                    type="button"
                                    onClick={actions.handleCheckForUpdate}
                                >
                                    {i18n._('Check for updates')}
                                </button>
                                <div className={styles['autoupdate-message']}>
                                    {autoupdateMessage}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
export default SoftwareUpdate;
