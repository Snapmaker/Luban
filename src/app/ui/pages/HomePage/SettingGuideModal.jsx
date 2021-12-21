import React, { useState, useEffect } from 'react';
import i18next from 'i18next';
import classNames from 'classnames';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import Uri from 'jsuri';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { MACHINE_SERIES,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_SM2
} from '../../../constants';
import { actions as machineActions } from '../../../flux/machine';
import { machineStore } from '../../../store/local-storage';

import Modal from '../../components/Modal';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import Checkbox from '../../components/Checkbox';

const machineSeriesOptions = [
    {
        value: MACHINE_SERIES.ORIGINAL.value,
        label: MACHINE_SERIES.ORIGINAL.label,
        size: MACHINE_SERIES.ORIGINAL.setting.size,
        lz: {
            value: MACHINE_SERIES.ORIGINAL_LZ.value,
            size: MACHINE_SERIES.ORIGINAL_LZ.setting.size
        },
        img: '/resources/images/machine/size-1.0-original.jpg'
    },
    {
        value: MACHINE_SERIES.A150.value,
        label: MACHINE_SERIES.A150.label,
        size: MACHINE_SERIES.A150.setting.size,
        img: '/resources/images/machine/size-2.0-A150.png'
    },
    {
        value: MACHINE_SERIES.A250.value,
        label: MACHINE_SERIES.A250.label,
        size: MACHINE_SERIES.A250.setting.size,
        img: '/resources/images/machine/size-2.0-A250.png'
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
const printingToolHeadOption = [
    {
        value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
        label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label
    }, {
        value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
        label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label
    }
];
const printingToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
        label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].label
    }
];
const laserToolHeadOption = [
    {
        value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
        label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label
    }, {
        value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
        label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label
    }
];
const laserToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
        label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].label
    }, {
        value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_ORIGINAL].value,
        label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_ORIGINAL].label
    }
];
const cncToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value,
        label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].label
    }
];
const cncToolHeadOption = [
    {
        value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
        label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label
    }
];
const SettingGuideModal = (props) => {
    const dispatch = useDispatch();
    // const machine = useSelector(state => state?.machine);
    const languageArr = ['de', 'en', 'es', 'fr', 'it', 'ru', 'uk', 'ko', 'ja', 'zh-cn'];
    const [lang, setLang] = useState(includes(languageArr, i18next.language) ? i18next.language : 'en');
    // const initLang = includes(languageArr, i18next.language) ? i18next.language : 'en';
    const [settingStep, setSettingStep] = useState('lang');
    const [machineSeries, setMachineSeries] = useState(3);
    const [zAxis, setZAxis] = useState(false);
    const [printingToolheadSelected, setPrintingToolheadSelected] = useState(MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value);
    const [laserToolheadSelected, setLaserToolheadSelected] = useState(MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value);
    const [cncToolheadSelected, setCncToolheadSelected] = useState(MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value);
    useEffect(() => {
        if (!machineSeries) {
            setPrintingToolheadSelected(MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value);
            setLaserToolheadSelected(MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value);
            setCncToolheadSelected(MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value);
        } else {
            setPrintingToolheadSelected(MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value);
            setLaserToolheadSelected(MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value);
            setCncToolheadSelected(MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value);
        }
    }, [machineSeries]);

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
    const handleSubmit = () => {
        // if update guide content, change the version
        machineStore.set('settings.guideVersion', 2);
        machineStore.set('settings.finishGuide', true);
        i18next.changeLanguage(lang, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', lang);
            window.location.search = uri.toString();
            const currentZAxis = zAxis ? 1 : 0;
            const toolHead = {
                printingToolhead: printingToolheadSelected,
                laserToolhead: laserToolheadSelected,
                cncToolhead: cncToolheadSelected
            };
            dispatch(machineActions.updateMachineSeries(machineSeries === 0 && !!zAxis ? machineSeriesOptions[0]?.lz?.value : machineSeriesOptions[machineSeries].value));
            dispatch(machineActions.updateMachineSize(machineSeries === 0 && !!zAxis ? machineSeriesOptions[0]?.lz?.size : machineSeriesOptions[machineSeries].size));
            dispatch(machineActions.setZAxisModuleState(machineSeries === 0 ? null : currentZAxis));
            dispatch(machineActions.updateMachineToolHead(toolHead, machineSeries === 0 && !!zAxis ? machineSeriesOptions[0]?.lz?.value : machineSeriesOptions[machineSeries].value));
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
        machineStore.set('settings.guideVersion', 2);
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
    const handleToolheadChange = (e, type) => {
        const nextValue = e.value;
        switch (type) {
            case 'printing':
                setPrintingToolheadSelected(nextValue);
                break;
            case 'laser':
                setLaserToolheadSelected(nextValue);
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
                            <div className={styles.langSelect} style={{ width: '552px', height: '256px', paddingTop: '32px' }}>
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
                            <div className={styles.machineSelect} style={{ paddingTop: '12px', paddingLeft: '16px', paddingRight: '16px' }}>
                                <div className={classNames(styles.titleLabel, 'heading-1')}>{i18n._('key-HomePage/Begin-Select Machine')}</div>
                                <div className={styles.machineContent}>
                                    <div className={styles.machineImg}>
                                        <SvgIcon
                                            size={48}
                                            name="LeftSlipNormal"
                                            onClick={() => handleMachineChange('up')}
                                            borderRadius={8}
                                        />
                                        <div className="text-align-center">
                                            <img
                                                width="240px"
                                                src={machineSeriesOptions[machineSeries].img}
                                                alt={machineSeriesOptions[machineSeries].value}
                                            />
                                            <div className="align-c heading-3 margin-bottom-8">{i18n._(machineSeriesOptions[machineSeries].label)}</div>
                                            <div className={styles.machineSize}>
                                                <span className="main-text-normal margin-right-12">{i18n._('key-HomePage/Begin-Work Area')}:</span>
                                                {
                                                    !zAxis && (
                                                        <span className="main-text-normal">
                                                            {`${machineSeriesOptions[machineSeries].size.x} mm × ${machineSeriesOptions[machineSeries].size.y} mm × ${machineSeriesOptions[machineSeries].size.z} mm`}
                                                        </span>
                                                    )
                                                }
                                                {
                                                    zAxis && machineSeries === 0 && (
                                                        <span className="main-text-normal">
                                                            {`${machineSeriesOptions[0]?.lz?.size?.x} mm × ${machineSeriesOptions[0]?.lz?.size?.y} mm × ${machineSeriesOptions[0]?.lz?.size?.z} mm`}
                                                        </span>
                                                    )
                                                }
                                            </div>
                                        </div>
                                        <SvgIcon
                                            size={48}
                                            name="RightSlipNormal"
                                            onClick={() => handleMachineChange('down')}
                                            borderRadius={8}
                                        />
                                    </div>
                                    <div className={classNames(styles.machineInfo, 'margin-left-16')}>
                                        {
                                            machineSeries === 0 && (
                                                <div className={styles.zAxisSelect}>
                                                    <Checkbox
                                                        onChange={e => setZAxis(e.target.checked)}
                                                        checked={zAxis}
                                                    />
                                                    <div className="margin-left-8">{i18n._('key-HomePage/Begin-Z-Axis Extension Module')}</div>
                                                </div>
                                            )
                                        }
                                        <div className={styles.headDetail}>
                                            <div className={classNames(styles.printingSelect, 'margin-bottom-16')}>
                                                <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}</span>
                                                <Select
                                                    value={printingToolheadSelected}
                                                    options={(machineSeries === 0 ? printingToolHeadOptionForOriginal : printingToolHeadOption).map(item => {
                                                        return {
                                                            value: item.value,
                                                            label: i18n._(item.label)
                                                        };
                                                    })}
                                                    onChange={e => handleToolheadChange(e, 'printing')}
                                                    size="large"
                                                />
                                            </div>
                                            <div className={classNames(styles.laserSelect, 'margin-bottom-16')}>
                                                <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-Laser Toolhead')}</span>
                                                <Select
                                                    value={laserToolheadSelected}
                                                    showSearch={false}
                                                    options={(machineSeries === 0 ? laserToolHeadOptionForOriginal : laserToolHeadOption).map(item => {
                                                        return {
                                                            value: item.value,
                                                            label: i18n._(item.label)
                                                        };
                                                    })}
                                                    onChange={e => handleToolheadChange(e, 'laser')}
                                                    size="large"
                                                />
                                            </div>
                                            <div className={classNames(styles.laserSelect, 'margin-bottom-16')}>
                                                <span className="main-text-normal margin-right-16">{i18n._('key-App/Settings/MachineSettings-CNC Toolhead')}</span>
                                                <Select
                                                    value={cncToolheadSelected}
                                                    options={(machineSeries === 0 ? cncToolHeadOptionForOriginal : cncToolHeadOption).map(item => ({
                                                        value: item.value,
                                                        label: i18n._(item.label)
                                                    }))}
                                                    onChange={e => handleToolheadChange(e, 'cnc')}
                                                    size="large"
                                                    disabled
                                                />
                                            </div>
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
