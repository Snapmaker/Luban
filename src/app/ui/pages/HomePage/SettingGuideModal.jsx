import React, { useEffect, useState } from 'react';
import i18next from 'i18next';
import classNames from 'classnames';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import Uri from 'jsuri';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';

import {
    getMachineOptions,
    getMachineSupportedToolOptions,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    MACHINE_TOOL_HEADS,
    MACHINE_TYPE_MULTI_FUNCTION_PRINTER,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    STANDARD_CNC_TOOLHEAD_FOR_SM2
} from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine';
import { machineStore } from '../../../store/local-storage';

import Modal from '../../components/Modal';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';


// TODO: Refactor this.
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

const SettingGuideModal = (props) => {
    const dispatch = useDispatch();
    // const machine = useSelector(state => state?.machine);
    const languageArr = ['de', 'en', 'es', 'fr', 'it', 'ru', 'uk', 'ko', 'ja', 'zh-cn'];
    const [lang, setLang] = useState(includes(languageArr, i18next.language) ? i18next.language : 'en');
    // const initLang = includes(languageArr, i18next.language) ? i18next.language : 'en';
    const [settingStep, setSettingStep] = useState('lang');

    // machine options
    const machineOptions = getMachineOptions();
    const [machineIndex, setMachineIndex] = useState(0);
    const [machine, setMachine] = useState(null);
    useEffect(() => {
        const machineOption = machineOptions[machineIndex];

        if (machineOption) {
            setMachine(machineOption.machine);
        }
    }, [machineIndex]);

    // tool head options
    const [printingToolHeadOptions, setPrintingToolHeadOptions] = useState([]);
    const [laserToolHeadOptions, setLaserToolHeadOptions] = useState([]);
    const [cncToolHeadOptions, setCncToolHeadOptions] = useState([]);

    const [printingToolHeadSelected, setPrintingToolHeadSelected] = useState('');
    const [laserToolHeadSelected, setLaserToolHeadSelected] = useState('');
    const [cncToolHeadSelected, setCncToolHeadSelected] = useState('');


    useEffect(() => {
        if (!machine) {
            return;
        }

        const printingOptions = getMachineSupportedToolOptions(machine.value, HEAD_PRINTING);
        setPrintingToolHeadOptions(printingOptions);

        if (printingOptions.length > 0) {
            setPrintingToolHeadSelected(printingOptions[0].value);
        }

        const laserOptions = getMachineSupportedToolOptions(machine.value, HEAD_LASER);
        setLaserToolHeadOptions(laserOptions);

        if (laserOptions.length > 0) {
            setLaserToolHeadSelected(laserOptions[0].value);
        }

        const cncOptions = getMachineSupportedToolOptions(machine.value, HEAD_CNC);
        setCncToolHeadOptions(cncOptions);

        if (cncOptions.length > 0) {
            setCncToolHeadSelected(cncOptions[0].value);
        }
    }, [machine]);

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
    /**
     * Final submit.
     */
    const handleSubmit = () => {
        // if update guide content, change the version below
        machineStore.set('settings.guideVersion', 4);
        machineStore.set('settings.finishGuide', true);
        i18next.changeLanguage(lang, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', lang);
            window.location.search = uri.toString();
            const toolHead = {
                printingToolhead: printingToolHeadSelected,
                laserToolhead: laserToolHeadSelected,
                cncToolhead: cncToolHeadSelected
            };
            dispatch(machineActions.updateMachineSeries(machine.value));
            dispatch(machineActions.updateMachineSize(machine.size));
            dispatch(machineActions.updateMachineToolHead(toolHead, machine.value));
            window.location.href = '/';
        });
        props.handleModalShow(false);
    };
    const handleCancel = () => {
        const toolHead = {
            printingToolhead: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            laserToolhead: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            cncToolhead: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value
        };
        dispatch(machineActions.updateMachineSeries('A350'));
        dispatch(machineActions.updateMachineToolHead(toolHead, 'A350'));
        machineStore.set('settings.guideVersion', 4);
        machineStore.set('settings.finishGuide', true);
        i18next.changeLanguage(props.initLanguage, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', props.initLanguage);
            window.location.search = uri.toString();
        });
        props.handleModalShow(false);
    };
    const handleMachineChange = (type) => {
        if (type === 'up') {
            const newMachineIndex = (machineIndex - 1 + machineOptions.length) % machineOptions.length;
            setMachineIndex(newMachineIndex);
        } else if (type === 'down') {
            const newMachineIndex = (machineIndex + 1) % machineOptions.length;
            setMachineIndex(newMachineIndex);
        }
    };
    const handleToolheadChange = (e, type) => {
        const nextValue = e.value;
        switch (type) {
            case 'printing':
                setPrintingToolHeadSelected(nextValue);
                break;
            case 'laser':
                setLaserToolHeadSelected(nextValue);
                break;
            case 'cnc':
                setCncToolHeadSelected(nextValue);
                break;
            default:
                break;
        }
    };

    return (
        <div>
            <Modal disableOverlay size="sm" onClose={handleCancel} className={styles.settingModal}>
                <Modal.Header>
                    {i18n._('key-HomePage/Begin-Configuration Wizard')}
                </Modal.Header>
                <Modal.Body>
                    {
                        settingStep === 'lang' && (
                            <div
                                className={styles.langSelect}
                                style={{
                                    width: '552px',
                                    height: '256px',
                                    paddingTop: '32px'
                                }}
                            >
                                <div className={classNames(styles.titleLabel, 'heading-1')}>
                                    {`${i18n._('key-HomePage/Begin-Select Language')}`}
                                </div>
                                <Select
                                    className={classNames(styles.langSelectInput, 'margin-auto', 'width-200')}
                                    clearable={false}
                                    size="super-large"
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
                            <div
                                className={styles['machine-select']}
                                style={{
                                    paddingTop: '12px',
                                    paddingLeft: '16px',
                                    paddingRight: '16px'
                                }}
                            >
                                <div className={classNames(styles.titleLabel, 'heading-1')}>{i18n._('key-HomePage/Begin-Select Machine')}</div>
                                <div className={styles['machine-content']}>
                                    <div className={styles['machine-image']}>
                                        <SvgIcon
                                            size={48}
                                            name="LeftSlipNormal"
                                            onClick={() => handleMachineChange('up')}
                                            borderRadius={8}
                                        />
                                        <div className="text-align-center">
                                            <img
                                                width="240px"
                                                src={machine.img}
                                                alt={machine.value}
                                            />
                                            <div className="heading-3 margin-bottom-8">{i18n._(machine.label)}</div>
                                            <div>
                                                <span className="main-text-normal margin-right-4">{i18n._('key-HomePage/Begin-Work Area')}:</span>
                                                <span className="main-text-normal">
                                                    {`${machine.size.x} mm × ${machine.size.y} mm × ${machine.size.z} mm`}
                                                </span>
                                            </div>
                                        </div>
                                        <SvgIcon
                                            size={48}
                                            name="RightSlipNormal"
                                            onClick={() => handleMachineChange('down')}
                                            borderRadius={8}
                                        />
                                    </div>
                                    <div className={classNames(styles['machine-info'], 'margin-left-16')}>
                                        <div className={styles['head-detail']}>
                                            <div className={classNames(styles['tool-select'], 'margin-bottom-16')}>
                                                <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}</span>
                                                <Select
                                                    value={printingToolHeadSelected}
                                                    options={printingToolHeadOptions.map(item => {
                                                        return {
                                                            value: item.value,
                                                            label: i18n._(item.label)
                                                        };
                                                    })}
                                                    onChange={e => handleToolheadChange(e, 'printing')}
                                                    size="large"
                                                    disabled={printingToolHeadOptions.length <= 1}
                                                />
                                            </div>
                                            {
                                                machine.machineType === MACHINE_TYPE_MULTI_FUNCTION_PRINTER && (
                                                    <div className={classNames(styles['tool-select'], 'margin-bottom-16')}>
                                                        <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-Laser Toolhead')}</span>
                                                        <Select
                                                            value={laserToolHeadSelected}
                                                            showSearch={false}
                                                            options={laserToolHeadOptions.map(item => {
                                                                return {
                                                                    value: item.value,
                                                                    label: i18n._(item.label)
                                                                };
                                                            })}
                                                            onChange={e => handleToolheadChange(e, 'laser')}
                                                            size="large"
                                                            disabled={laserToolHeadOptions.length <= 1}
                                                        />
                                                    </div>
                                                )
                                            }
                                            {
                                                machine.machineType === MACHINE_TYPE_MULTI_FUNCTION_PRINTER && (
                                                    <div className={classNames(styles['tool-select'], 'margin-bottom-16')}>
                                                        <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-CNC Toolhead')}</span>
                                                        <Select
                                                            value={cncToolHeadSelected}
                                                            options={cncToolHeadOptions.map(item => ({
                                                                value: item.value,
                                                                label: i18n._(item.label)
                                                            }))}
                                                            onChange={e => handleToolheadChange(e, 'cnc')}
                                                            size="large"
                                                            disabled={cncToolHeadOptions.length <= 1}
                                                        />
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
                        type="default"
                        width="96px"
                        priority="level-two"
                        className="display-inline"
                    >
                        {i18n._('key-HomePage/Begin-Cancel')}
                    </Button>
                    {
                        settingStep === 'lang' && (
                            <Button
                                onClick={handleStepChange}
                                type="primary"
                                width="96px"
                                priority="level-two"
                                className="display-inline margin-horizontal-8"
                            >
                                {i18n._('key-HomePage/Begin-Next')}
                            </Button>
                        )
                    }
                    {
                        settingStep === 'machine' && (
                            <Button
                                onClick={handleSubmit}
                                type="primary"
                                width="96px"
                                priority="level-two"
                                className="display-inline margin-horizontal-8"
                            >
                                {i18n._('key-HomePage/Begin-Complete')}
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
