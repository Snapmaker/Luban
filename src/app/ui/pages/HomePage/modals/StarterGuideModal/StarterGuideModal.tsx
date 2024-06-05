import type { Machine } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';
import { Checkbox } from 'antd';
import type { CheckboxValueType } from 'antd/es/checkbox/Group';
import classNames from 'classnames';
import i18next from 'i18next';
import Uri from 'jsuri';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    STANDARD_CNC_TOOLHEAD_FOR_SM2,
    findMachineModule,
    getMachineOptions,
    getMachineSupportedToolOptions,
} from '../../../../../constants/machines';
import { actions as machineActions } from '../../../../../flux/machine';
import i18n from '../../../../../lib/i18n';
import { machineStore } from '../../../../../store/local-storage';
import { Button } from '../../../../components/Buttons';
import Modal from '../../../../components/Modal';
import Select from '../../../../components/Select';
import SvgIcon from '../../../../components/SvgIcon';
import { languageOptions, languages } from './constants';
import styles from './styles.styl';
import { SnapmakerArtisanMachine } from '../../../../../machines';
import { dualExtrusionPrintToolHead } from '../../../../../machines/snapmaker-2-toolheads';
import { RootState } from '../../../../../flux/index.def';


interface StarterGuideLanguageStepProps {
    lang: string;
    setLang: (language: string) => void;
}

const StarterGuideLanguageStep: React.FC<StarterGuideLanguageStepProps> = (props) => {
    const lang = props.lang;
    const setLang = props.setLang;

    const handleLanguageChange = useCallback((option) => {
        const nextLang = option.value;
        i18next.changeLanguage(nextLang, () => {
            setLang(nextLang);
        });
    }, [setLang]);

    return (
        <div
            className={styles['lang-select']}
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
    );
};

type StarterGuideStepType = 'lang' | 'machine'

interface StarterGuideModalProps {
    handleModalShow: (show: boolean) => void;
    initLanguage: string;
}

/**
 * Starter guide modal.
 *
 * 1. Select language
 * 2. Select machine & tool
 */
const StarterGuideModal: React.FC<StarterGuideModalProps> = (props) => {
    // step controls which setting view to be shown
    const [settingStep, setSettingStep] = useState<StarterGuideStepType>('lang');
    const isMultiDualExtrusion = useSelector((state: RootState) => state.machine?.isMultiDualExtrusion);

    // language
    const [lang, setLang] = useState('en');

    useEffect(() => {
        if (includes(languages, i18next.language)) {
            setLang(i18next.language);
        } else {
            setLang('en');
        }
    }, []);

    // machine options
    const machineOptions = useMemo(() => getMachineOptions(), []);
    const [machineIndex, setMachineIndex] = useState(0);
    const [modules, setModules] = useState([]);

    // temperary machine selected
    const machine = useMemo<Machine | null>(() => {
        const machineOption = machineOptions[machineIndex];
        if (machineOption) {
            return machineOption.machine;
        } else {
            return null;
        }
    }, [machineOptions, machineIndex]);

    const handleMachineChange = useCallback((type) => {
        if (type === 'up') {
            const newMachineIndex = (machineIndex - 1 + machineOptions.length) % machineOptions.length;
            setMachineIndex(newMachineIndex);
        } else if (type === 'down') {
            const newMachineIndex = (machineIndex + 1) % machineOptions.length;
            setMachineIndex(newMachineIndex);
        }
    }, [machineOptions, machineIndex]);

    const isMultiFunctionMachine = machine && machine.machineType === MachineType.MultiFuncionPrinter;
    const is3DPrinter = machine && machine.machineType === MachineType.Printer;
    const isLaserMachine = machine && machine.machineType === MachineType.Laser;


    // machine tools
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

        let printingOptions = getMachineSupportedToolOptions(machine.identifier, HEAD_PRINTING);
        // hard-code for artsian dualextrusion; No dualextrusion for 2.0 option by default
        if (includes([SnapmakerArtisanMachine.identifier], machine.identifier) && !isMultiDualExtrusion) {
            printingOptions = printingOptions.filter(toolOption => toolOption.value !== dualExtrusionPrintToolHead.identifier);
        }
        setPrintingToolHeadOptions(printingOptions);

        if (printingOptions.length > 0) {
            setPrintingToolHeadSelected(printingOptions[0].value);
        }

        const laserOptions = getMachineSupportedToolOptions(machine.identifier, HEAD_LASER);
        setLaserToolHeadOptions(laserOptions);

        if (laserOptions.length > 0) {
            setLaserToolHeadSelected(laserOptions[0].value);
        }

        const cncOptions = getMachineSupportedToolOptions(machine.identifier, HEAD_CNC);
        setCncToolHeadOptions(cncOptions);

        if (cncOptions.length > 0) {
            setCncToolHeadSelected(cncOptions[0].value);
        }
    }, [machine, isMultiDualExtrusion]);

    const handleToolheadChange = useCallback((e, type) => {
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
    }, []);

    // machine modules
    const machineModuleOptions = useMemo(() => {
        if (machine && machine.metadata?.modules) {
            const options = [];

            for (const moduleOptions of machine.metadata.modules) {
                const machineModule = findMachineModule(moduleOptions.identifier);

                if (machineModule) {
                    options.push({
                        value: moduleOptions.identifier,
                        label: i18n._(machineModule.name),
                    });
                }
            }

            return options;
        } else {
            return [];
        }
    }, [machine]);

    const onCheckMachineModule = useCallback((checkedValues: CheckboxValueType[]) => {
        setModules(checkedValues);
    }, []);

    // change setting step
    const handleStepChange = () => {
        if (settingStep === 'lang') {
            setSettingStep('machine');
        }
    };

    const dispatch = useDispatch();

    /**
     * Submit.
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
            dispatch(machineActions.updateMachineSeries(machine.identifier));
            dispatch(machineActions.updateMachineSize(machine.metadata.size));
            dispatch(machineActions.updateMachineToolHead(toolHead, machine.identifier));
            dispatch(machineActions.setMachineModules(modules));

            window.location.href = '/';
        });

        props.handleModalShow(false);
    };

    /**
     * Cancel.
     */
    const handleCancel = () => {
        machineStore.set('settings.guideVersion', 4);
        machineStore.set('settings.finishGuide', true);

        const toolHead = {
            printingToolhead: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            laserToolhead: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            cncToolhead: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value
        };

        dispatch(machineActions.updateMachineSeries('A350'));
        dispatch(machineActions.updateMachineToolHead(toolHead, 'A350'));
        dispatch(machineActions.setMachineModules([]));

        i18next.changeLanguage(props.initLanguage, () => {
            const uri = new Uri(window.location.search);
            uri.replaceQueryParam('lang', props.initLanguage);
            window.location.search = uri.toString();
        });

        props.handleModalShow(false);
    };


    const machineSize = machine?.metadata.size;

    const [isOpenArtsianDualExtrusionSelectModal, setIsOpenArtsianDualExtrusionSelectModal] = useState<boolean>(false);
    const selectedArtisan = useMemo(() => {
        return includes([SnapmakerArtisanMachine.identifier], machine.identifier);
    }, [machine]);
    const openArtsianDualExtrusionSelectModal = () => {
        setIsOpenArtsianDualExtrusionSelectModal(true);
    };
    const renderArtsianDualExtrusionSelectModal = () => {
        return (
            <Modal
                size="sm"
                style={{ minWidth: 700 }}
                onClose={() => setIsOpenArtsianDualExtrusionSelectModal(false)}
            >
                <Modal.Header>
                    <div>
                        {i18n._('Print Settings')}
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div className="margin-bottom-16">
                        <Checkbox
                            defaultChecked={isMultiDualExtrusion}
                            checked={isMultiDualExtrusion}
                            onChange={(event) => {
                                // hard-code for artsian dualextrusion
                                dispatch(machineActions.updateIsMultiDualExtrusion(event.target.checked));
                            }}
                        />
                        aaaaaaaaaaaaaa
                    </div>
                </Modal.Body>
            </Modal>
        );
    };

    return (
        <>
            <Modal size="sm" onClose={handleCancel} className={styles['setting-modal']}>
                <Modal.Header>
                    {i18n._('key-HomePage/Begin-Configuration Wizard')}
                </Modal.Header>
                <Modal.Body>
                    {
                        settingStep === 'lang' && (
                            <StarterGuideLanguageStep
                                lang={lang}
                                setLang={setLang}
                            />
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
                                                alt={machine.fullName}
                                            />
                                            <div className="heading-3 margin-bottom-8">{i18n._(machine.fullName)}</div>
                                            <div>
                                                <span className="main-text-normal margin-right-4">{i18n._('key-HomePage/Begin-Work Area')}:</span>
                                                <span className="main-text-normal">
                                                    {`${machineSize.x} mm × ${machineSize.y} mm × ${machineSize.z} mm`}
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
                                            {
                                                (is3DPrinter || isMultiFunctionMachine) && (
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
                                                        {
                                                            selectedArtisan && <i onClick={openArtsianDualExtrusionSelectModal} className="fa fa-info-circle margin-left-8 cursor-pointer" aria-hidden="true" />
                                                        }
                                                    </div>
                                                )
                                            }
                                            {
                                                (isLaserMachine || isMultiFunctionMachine) && (
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
                                                isMultiFunctionMachine && (
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
                                            {
                                                machineModuleOptions.length > 0 && (
                                                    <div className={classNames(styles['head-detail'], 'margin-top-8')}>
                                                        <div className="margin-bottom-16">
                                                            <Checkbox.Group
                                                                className={classNames(styles['modules-select-list'])}
                                                                options={machineModuleOptions}
                                                                onChange={onCheckMachineModule}
                                                                defaultValue={modules}
                                                            />
                                                        </div>
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
            {isOpenArtsianDualExtrusionSelectModal && renderArtsianDualExtrusionSelectModal()}
        </>
    );
};

export default StarterGuideModal;
