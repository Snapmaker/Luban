import classNames from 'classnames';
import get from 'lodash/get';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import FacebookLoading from 'react-facebook-loading';
// import { connect } from 'react-redux';
// import settings from '../../../../config/settings';
import i18n from '../../../../../lib/i18n';
import Checkbox from '../../../../components/Checkbox';
import { Button } from '../../../../components/Buttons';
import SvgIcon from '../../../../components/SvgIcon';
import Select from '../../../../components/Select';
// import styles from './index.styl';
import UniApi from '../../../../../lib/uni-api';
import { actions as machineActions } from '../../../../../flux/machine';
import SubMenuitemWrapper from './SubMenuItemWrapper';


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
//                     {i18n._('key-App/Settings/General-A web-based interface which is able to do 3D printing, laser engraving and CNC carving.')}
//                     <Space width={8} />
//                     <Anchor
//                         className={styles['learn-more']}
//                         href="https://snapmaker.com/support"
//                         target="_blank"
//                     >
//                         {i18n._('key-App/Settings/General-Learn more')}
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
        value: 'zh-CN',
        label: '中文 (简体)'
    }
];

function General({ state: generalState, actions }) {
    const isDownloading = useSelector(state => state?.machine?.isDownloading, shallowEqual);
    const shouldCheckForUpdate = useSelector(state => state?.machine?.shouldCheckForUpdate, shallowEqual);
    const shouldAutoPreviewGcode = useSelector(state => state?.machine?.shouldAutoPreviewGcode, shallowEqual);
    const shouldHideConsole = useSelector(state => state?.machine?.shouldHideConsole, shallowEqual);
    const autoupdateMessage = useSelector(state => state?.machine?.autoupdateMessage, shallowEqual);
    const promptDamageModel = useSelector(state => state?.machine?.promptDamageModel, shallowEqual);
    const enable3dpLivePreview = useSelector(state => state?.machine?.enable3dpLivePreview, shallowEqual);
    const dispatch = useDispatch();
    const updateShouldCheckForUpdate = (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate));
    const updateShouldAutoPreviewGcode = (bool) => dispatch(machineActions.updateShouldAutoPreviewGcode(bool));
    const updateShouldHideConsole = (bool) => dispatch(machineActions.updateShouldHideConsole(bool));
    const updatePromptDamageModel = (bool) => dispatch(machineActions.updatePromptDamageModel(bool));
    const updateEnable3dpLivePreview = (bool) => dispatch(machineActions.updateEnable3dpLivePreview(bool));

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
                        <span className="margin-left-4">{i18n._('key-App/Settings/General-Language')}</span>
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
                            <span className="margin-left-4">{i18n._('key-App/Settings/General-Software Update')}</span>
                        </div>
                        <Button
                            className={classNames(
                                'margin-top-16'
                            )}
                            width="auto"
                            onClick={handleCheckForUpdate}
                        >
                            {i18n._('key-App/Settings/General-Check for updates')}
                        </Button>
                        <div className="display-block margin-left-8 height-32">
                            <Checkbox
                                checked={shouldCheckForUpdate}
                                onChange={(event) => { updateShouldCheckForUpdate(event.target.checked); }}
                            />
                            <span className="margin-left-4">
                                {i18n._('key-App/Settings/General-Automatically check for updates')}
                            </span>
                        </div>
                        <div className="margin-vertical-4">
                            {autoupdateMessage}
                        </div>
                    </div>
                    <div className="margin-top-16">
                        <div className="border-bottom-normal padding-bottom-4">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                            />
                            <span className="margin-left-4">{i18n._('key-App/Settings/General-File Preview')}</span>
                        </div>
                        <div className="display-block margin-left-8 height-32">
                            <Checkbox
                                checked={shouldAutoPreviewGcode}
                                onChange={(event) => { updateShouldAutoPreviewGcode(event.target.checked); }}
                            />
                            <span className="margin-left-4">
                                {i18n._('key-App/Settings/General-Preview file when import G code to workspace')}
                            </span>
                        </div>
                    </div>
                    <SubMenuitemWrapper title={i18n._('key-App/Settings/General-Workspace Setting')}>
                        <Checkbox
                            checked={shouldHideConsole}
                            onChange={(event) => { updateShouldHideConsole(event.target.checked); }}
                        />
                        <span className="margin-left-4">
                            {i18n._('key-App/Settings/General-Workspace Hide the console when working')}
                        </span>
                    </SubMenuitemWrapper>
                    <SubMenuitemWrapper title={i18n._('key-App/Settings/Model Examination')}>
                        <Checkbox
                            checked={promptDamageModel}
                            onChange={(event) => { updatePromptDamageModel(event.target.checked); }}
                        />
                        <span className="margin-left-4">
                            {i18n._('key-App/Settings/Pop up a reminder when importing deficient model(s)')}
                        </span>
                    </SubMenuitemWrapper>
                    <SubMenuitemWrapper title={i18n._('key-App/Settings/3D Printing Setting')}>
                        <Checkbox
                            checked={enable3dpLivePreview}
                            onChange={(event) => { updateEnable3dpLivePreview(event.target.checked); }}
                        />
                        <span className="margin-left-4">
                            {i18n._('key-App/Settings/Enable 3D Printing Live Preview')}
                        </span>
                    </SubMenuitemWrapper>
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
