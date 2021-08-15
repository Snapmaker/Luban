/* eslint-disable */
import React, { useState } from 'react';
import i18next from 'i18next';
import classNames from 'classnames';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import Uri from 'jsuri';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { MACHINE_SERIES } from '../../../constants';
import { actions as machineActions } from '../../../flux/machine';
import { machineStore } from '../../../store/local-storage';

import Modal from '../../components/Modal';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Anchor from '../../components/Anchor';
import Select from '../../components/Select';

const SettingGuideModal = (props) => {
    const dispatch = useDispatch();
    // const machine = useSelector(state => state?.machine);
    const languageArr = ['de', 'en', 'es', 'fr', 'it', 'ru', 'uk', 'ko', 'ja', 'zh-cn'];
    const [lang, setLang] = useState(includes(languageArr, i18next.language) ? i18next.language : 'en');
    // const initLang = includes(languageArr, i18next.language) ? i18next.language : 'en';
    const [settingStep, setSettingStep] = useState('lang');
    const [machineSeries, setMachineSeries] = useState(3);
    const [zAxis, setZAxis] = useState(false);
    const machineSeriesOptions = [
        {
            value: MACHINE_SERIES.ORIGINAL.value,
            label: MACHINE_SERIES.ORIGINAL.label,
            size: MACHINE_SERIES.ORIGINAL.setting.size,
            lz: {
                value: MACHINE_SERIES.ORIGINAL_LZ.value,
                // label: MACHINE_SERIES.ORIGINAL_LZ.label,
                size: MACHINE_SERIES.ORIGINAL_LZ.setting.size,
            },
            img: '/resources/images/machine/size-1.0-original.jpg'
        },
        {
            value: MACHINE_SERIES.A150.value,
            label: MACHINE_SERIES.A150.label,
            size: MACHINE_SERIES.A150.setting.size,
            img: '/resources/images/machine/size-2.0-A150.jpg'
        },
        {
            value: MACHINE_SERIES.A250.value,
            label: MACHINE_SERIES.A250.label,
            size: MACHINE_SERIES.A250.setting.size,
            img: '/resources/images/machine/size-2.0-A250.jpg'
        },
        {
            value: MACHINE_SERIES.A350.value,
            label: MACHINE_SERIES.A350.label,
            size: MACHINE_SERIES.A350.setting.size,
            img: '/resources/images/machine/size-2.0-A350.jpg'
        }
    ];
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
    // change language method
    const handleLanguageChange = (e) => {
        const nextLang = e.value;
        i18next.changeLanguage(nextLang, () => {
            setLang(nextLang);
        });
    };
    // change setting step
    const handleStepChange = () => {
        if (settingStep === 'lang') {
            setSettingStep('machine');
        }
    };
    const handleSubmit =  () => {
        // if update guide content, change the version
        machineStore.set('settings.guideVersion', 1);
        machineStore.set('settings.finishGuide', true);
        i18next.changeLanguage(lang, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', lang);
            window.location.search = uri.toString();
            const currentZAxis = zAxis ? 1 : 0;
            dispatch(machineActions.updateMachineSeries(machineSeries === 0 && !!zAxis ? machineSeriesOptions[0]?.lz?.value : machineSeriesOptions[machineSeries].value));
            dispatch(machineActions.updateMachineSize(machineSeries === 0 && !!zAxis ? machineSeriesOptions[0]?.lz?.size : machineSeriesOptions[machineSeries].size));
            dispatch(machineActions.setZAxisModuleState(machineSeries === 0 ? null : currentZAxis));
            window.location.href = '/'
        });
        props.handleModalShow(false);
    };
    const handleCancel = () => {
        dispatch(machineActions.updateMachineSeries('A350'));
        machineStore.set('settings.guideVersion', 1);
        machineStore.set('settings.finishGuide', true);
        i18next.changeLanguage(props.initLanguage, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', props.initLanguage);
            window.location.search = uri.toString();
        });
        props.handleModalShow(false);
    };
    const handleMachineChange = (type) => {
        let newMachineSeries = machineSeries;
        if (zAxis) {
            setZAxis(false);
        }
        if (type === 'up') {
            newMachineSeries = (machineSeries + 1) % 4;
            setMachineSeries(newMachineSeries);
        } else if (type === 'down') {
            if (newMachineSeries <= 0) {
                newMachineSeries = 3;
            } else {
                newMachineSeries -= 1;
            }
            setMachineSeries(newMachineSeries);
        }
    };

    return (
        <div>
            <Modal disableOverlay size="sm" onClose={handleCancel} className={styles.settingModal}>
                <Modal.Header>
                    {i18n._('Configuration Wizard')}
                </Modal.Header>
                <Modal.Body>
                    {
                        settingStep === 'lang' && (
                            <div className={styles.langSelect} style={{width: '552px', height:'256px', marginTop: '16px'}}>
                                <div className={classNames(styles.titleLabel, 'heading-2')}>
                                    {`${i18n._('Select Language')}`}
                                </div>
                                <Select
                                    className={styles.langSelectInput}
                                    clearable={false}
                                    size='super-large'
                                    className='margin-auto'
                                    searchable={false}
                                    options={languageOptions}
                                    value={lang}
                                    onChange={handleLanguageChange}
                                />
                            </div>
                        )
                    }
                    {
                        settingStep === 'machine' && (
                            <div className={styles.machineSelect}>
                                <div className={classNames(styles.titleLabel, 'heading-2')}>{i18n._('Select machine')}</div>
                                <div className={styles.machineContent}>
                                    <div className={styles.machineImg}>
                                        <SvgIcon
                                            size={48}
                                            name='LeftSlipNormal'
                                            onClick={() => handleMachineChange('up')}
                                            borderRadius={8}
                                        />
                                        <div>
                                            <img
                                                width='240px'
                                                src={machineSeriesOptions[machineSeries].img}
                                                alt={machineSeriesOptions[machineSeries].value}
                                            />
                                        <div className='align-c'>{machineSeriesOptions[machineSeries].label}</div>
                                        </div>
                                        <SvgIcon
                                            size={48}
                                            name='RightSlipNormal'
                                            onClick={() => handleMachineChange('down')}
                                            borderRadius={8}
                                        />
                                    </div>
                                    <div className={classNames(styles.machineInfo, 'margin-left-16')}>
                                        {
                                            machineSeries === 0 && (
                                                <div className={styles.zAxisSelect}>
                                                    <input
                                                        checked={zAxis}
                                                        type="checkbox"
                                                        onChange={e => setZAxis(e.target.checked)}
                                                    />
                                                    <div>{i18n._('Z-Axis Extension Module')}</div>
                                                </div>
                                            )
                                        }
                                        <div className={styles.machineSize}>
                                            <div>{i18n._('Work Area')}:</div>
                                            {
                                                !zAxis && (
                                                    <div>
                                                        {`${machineSeriesOptions[machineSeries].size.x} mm × ${machineSeriesOptions[machineSeries].size.y} mm × ${machineSeriesOptions[machineSeries].size.z} mm`}
                                                    </div>
                                                )
                                            }
                                            {
                                                zAxis && machineSeries === 0 && (
                                                    <div>
                                                        {`${machineSeriesOptions[0]?.lz?.size?.x} mm × ${machineSeriesOptions[0]?.lz?.size?.y} mm × ${machineSeriesOptions[0]?.lz?.size?.z} mm`}
                                                    </div>
                                                )
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={handleCancel}
                        type='default'
                        width='96px'
                        priority='level-two'
                        className='display-inline'
                    >
                        {i18n._('Cancel')}
                    </Button>
                    {
                        settingStep === 'lang' && (
                            <Button
                                onClick={handleStepChange}
                                type='primary'
                                width='96px'
                                priority='level-two'
                                className='display-inline margin-horizontal-8'
                            >
                                {i18n._('Next')}
                            </Button>
                        )
                    }
                    {
                        settingStep === 'machine' && (
                            <Button
                                onClick={handleSubmit}
                                type='primary'
                                width='96px'
                                priority='level-two'
                                className='display-inline margin-horizontal-8   '
                            >
                                {i18n._('Complete')}
                            </Button>
                        )
                    }
                </Modal.Footer>
            </Modal>
        </div>
    );
};

SettingGuideModal.propTypes = {
    handleModalShow: PropTypes.func,
    initLanguage: PropTypes.string
};
export default SettingGuideModal;
