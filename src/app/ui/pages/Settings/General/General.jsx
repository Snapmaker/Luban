import classNames from 'classnames';
import get from 'lodash/get';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import FacebookLoading from 'react-facebook-loading';
// import { connect } from 'react-redux';
// import settings from '../../../../config/settings';
import i18n from '../../../../lib/i18n';
// import Anchor from '../../../components/Anchor';
// import Space from '../../../components/Space';
import styles from './index.styl';
import UniApi from '../../../../lib/uni-api';
import { actions as machineActions } from '../../../../flux/machine';

// const About = () => {
//     return (
//         <div className={styles['about-container']}>
//             <img
//                 src="/resources/images/snap-logo-square-256x256.png"
//                 role="presentation"
//                 alt="presentation"
//                 className={styles['product-logo']}
//             />
//             <div className={styles['product-details']}>
//                 <div className={styles['about-product-name']}>
//                     {`Snapmaker Luban ${settings.version}`}
//                 </div>
//                 <div className={styles['about-product-description']}>
//                     {i18n._('A web-based interface for Snapmaker which is able to do 3D Printing, laser engraving and CNC carving.')}
//                     <Space width={8} />
//                     <Anchor
//                         className={styles['learn-more']}
//                         href="https://snapmaker.com/support"
//                         target="_blank"
//                     >
//                         {i18n._('Learn more')}
//                         <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
//                     </Anchor>
//                 </div>
//             </div>
//         </div>
//     );
// };

function General({ state: generalState, actions }) {
    const isDownloading = useSelector(state => state?.machine?.isDownloading, shallowEqual);
    const shouldCheckForUpdate = useSelector(state => state?.machine?.shouldCheckForUpdate, shallowEqual);
    const autoupdateMessage = useSelector(state => state?.machine?.autoupdateMessage, shallowEqual);
    const dispatch = useDispatch();
    const updateShouldCheckForUpdate = (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate));

    const handlers = {
        changeLanguage: (event) => {
            const target = event.target;
            actions.changeLanguage(target.value);
        },
        cancel: () => {
            actions.restoreSettings();
        },
        save: () => {
            actions.save();
        }
    };

    const handleCheckForUpdate = () => {
        if (isDownloading) {
            UniApi.Update.downloadHasStarted();
        } else {
            UniApi.Update.checkForUpdate();
        }
    };

    useEffect(() => {
        actions.load();
    }, [actions]);

    useEffect(() => {
        function cleanup() {
            UniApi.Event.off('appbar-menu:settings.save', handlers.save);
            UniApi.Event.off('appbar-menu:settings.cancel', handlers.cancel);
        }
        cleanup();
        UniApi.Event.on('appbar-menu:settings.save', handlers.save);
        UniApi.Event.on('appbar-menu:settings.cancel', handlers.cancel);
        return cleanup;
    }, [handlers]);

    const lang = get(generalState, 'lang', 'en');

    if (generalState.api.loading) {
        return (
            <FacebookLoading
                delay={400}
                zoom={2}
                style={{ margin: '15px auto' }}
            />
        );
    }
    // NOTHING a b

    return (
        <div style={{ marginBottom: '55px' }}>
            {/* <About /> */}

            <form>
                <div className={styles['form-container']}>
                    <div className={styles['form-group']}>
                        <span>{i18n._('Language')}</span>
                        <select
                            className={classNames(
                                'form-control',
                                styles['form-control'],
                                styles.short
                            )}
                            value={lang}
                            onChange={handlers.changeLanguage}
                        >
                            <option value="de">Deutsch</option>
                            <option value="en">English (US)</option>
                            <option value="es">Español</option>
                            <option value="fr">Français (France)</option>
                            <option value="it">Italiano</option>
                            <option value="ru">Русский</option>
                            <option value="uk">Українська</option>
                            <option value="ko">한국어</option>
                            <option value="ja">日本語</option>
                            <option value="zh-cn">中文 (简体)</option>
                        </select>
                        <div className={styles['autoupdate-wrapper']}>
                            <p className={styles['update-title']}>{i18n._('Software Update')}</p>
                            <button
                                className={classNames(
                                    'btn',
                                    'btn-outline-secondary',
                                    styles['autoupdate-button'],
                                )}
                                type="button"
                                onClick={handleCheckForUpdate}
                            >
                                {i18n._('Check for updates')}
                            </button>
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
                            <div className={styles['autoupdate-message']}>
                                {autoupdateMessage}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

General.propTypes = {
    state: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

export default General;
