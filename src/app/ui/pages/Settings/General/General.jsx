import classNames from 'classnames';
import get from 'lodash/get';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import FacebookLoading from 'react-facebook-loading';
// import { connect } from 'react-redux';
// import settings from '../../../../config/settings';
import i18n from '../../../../lib/i18n';
import Checkbox from '../../../components/Checkbox';
import { Button } from '../../../components/Buttons';
import SvgIcon from '../../../components/SvgIcon';
import Select from '../../../components/Select';
// import styles from './index.styl';
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
//                     {i18n._('key_ui/pages/Settings/General/General_A web-based interface for Snapmaker which is able to do 3D Printing, laser engraving and CNC carving.')}
//                     <Space width={8} />
//                     <Anchor
//                         className={styles['learn-more']}
//                         href="https://snapmaker.com/support"
//                         target="_blank"
//                     >
//                         {i18n._('key_ui/pages/Settings/General/General_Learn more')}
//                         <i className="fa fa-arrow-circle-right" style={{ marginLeft: 5 }} />
//                     </Anchor>
//                 </div>
//             </div>
//         </div>
//     );
// };
const languageOptions = [
    {
        value: 'de',
        label: 'Deutsch'
    }, {
        value: 'en',
        label: 'English'
    }, {
        value: 'es',
        label: 'Español'
    }, {
        value: 'fr',
        label: 'Français'
    }, {
        value: 'it',
        label: 'Italiano'
    }, {
        value: 'ru',
        label: 'Русский'
    }, {
        value: 'uk',
        label: 'Українська'
    }, {
        value: 'ko',
        label: '한국어'
    }, {
        value: 'ja',
        label: '日本語'
    }, {
        value: 'zh-cn',
        label: '中文 (简体)'
    }
];

function General({ state: generalState, actions }) {
    const isDownloading = useSelector(state => state?.machine?.isDownloading, shallowEqual);
    const shouldCheckForUpdate = useSelector(state => state?.machine?.shouldCheckForUpdate, shallowEqual);
    const autoupdateMessage = useSelector(state => state?.machine?.autoupdateMessage, shallowEqual);
    const dispatch = useDispatch();
    const updateShouldCheckForUpdate = (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate));

    const handlers = {
        changeLanguage: (option) => {
            actions.changeLanguage(option?.value);
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
        <div>
            <form>
                <div>
                    <div className="border-bottom-normal padding-bottom-4">
                        <SvgIcon
                            name="TitleSetting"
                            type={['static']}
                        />
                        <span className="margin-left-4">{i18n._('key_ui/pages/Settings/General/General_Language')}</span>
                    </div>
                    <Select
                        className={classNames(
                            'margin-top-16'
                        )}
                        size="200px"
                        value={lang}
                        onChange={handlers.changeLanguage}
                        options={languageOptions}
                    />
                    <div className="margin-top-16">
                        <div className="border-bottom-normal padding-bottom-4">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                            />
                            <span className="margin-left-4">{i18n._('key_ui/pages/Settings/General/General_Software Update')}</span>
                        </div>
                        <Button
                            className={classNames(
                                'margin-top-16'
                            )}
                            width="auto"
                            onClick={handleCheckForUpdate}
                        >
                            {i18n._('key_ui/pages/Settings/General/General_Check for updates')}
                        </Button>
                        <div className="display-block margin-left-8 height-32">
                            <Checkbox
                                checked={shouldCheckForUpdate}
                                onChange={(event) => { updateShouldCheckForUpdate(event.target.checked); }}
                            />
                            <span className="margin-left-4">
                                {i18n._('key_ui/pages/Settings/General/General_Automatically check for updates')}
                            </span>
                        </div>
                        <div className="margin-vertical-4">
                            {autoupdateMessage}
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
