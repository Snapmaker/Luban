import classNames from 'classnames';
import React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
// import PropTypes from 'prop-types';
// import { connect } from 'react-redux';
import settings from '../../../../config/settings';
import i18n from '../../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import Checkbox from '../../../components/Checkbox';
import { Button } from '../../../components/Buttons';
import Space from '../../../components/Space';
import styles from './styles.styl';
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
        <div className={styles['autoupdate-wrapper']}>
            <div>
                <div className={styles['lu-logo-container']}>
                    <i className={styles.logo} />
                </div>
                <div className={styles['lu-version']}>
                    <div className={styles['product-details']}>
                        <div className={classNames(styles['about-product-name'], 'heading - 3')}>
                            {`Snapmaker Luban ${settings.version}`}
                        </div>
                        <div className={classNames(styles['about-product-description'], 'color-black-4')}>
                            {i18n._('key-App/Settings/SoftwareUpdate-An open-source slicing software which can 3D print, laser engrave, and CNC carve.')}
                            <Space width={8} />
                            <Anchor
                                className="link-text"
                                href="https://snapmaker.com/support"
                                target="_blank"
                            >
                                {i18n._('key-App/Settings/SoftwareUpdate-Learn more >')}
                            </Anchor>
                        </div>
                    </div>
                    <div className={styles['autoupdate-auto']}>
                        <Checkbox
                            className={styles['autoupdate-checkbox']}
                            checked={shouldCheckForUpdate}
                            onChange={(event) => { updateShouldCheckForUpdate(event.target.checked); }}
                        />
                        <span className={classNames(styles['autoupdate-text'], 'margin-left-8')}>
                            {i18n._('key-App/Settings/SoftwareUpdate-Automatically check for updates')}
                        </span>
                    </div>
                </div>
            </div>
            <div className={styles['autoupdate-update']}>
                <Button
                    onClick={actions.handleCheckForUpdate}
                >
                    {i18n._('key-App/Settings/SoftwareUpdate-Check for updates')}
                </Button>
                <div className={styles['autoupdate-message']}>
                    {autoupdateMessage}
                </div>
            </div>
        </div>
    );
}
export default SoftwareUpdate;
