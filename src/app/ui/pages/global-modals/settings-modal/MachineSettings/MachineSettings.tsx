import type { CheckboxValueType } from 'antd/es/checkbox/Group';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { includes } from 'lodash';
import { Checkbox } from 'antd';
import { Button } from '../../../../components/Buttons';
import {
    findMachineByName,
    findMachineModule,
    getMachineOptions,
    getMachineSupportedToolOptions,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
} from '../../../../../constants/machines';
import { RootState } from '../../../../../flux/index.def';
import { actions as machineActions } from '../../../../../flux/machine';
import { actions as projectActions } from '../../../../../flux/project';
import { actions as workspaceActions } from '../../../../../flux/workspace';
import i18n from '../../../../../lib/i18n';
import UniApi from '../../../../../lib/uni-api';
import { getCurrentHeadType } from '../../../../../lib/url-utils';
import Select from '../../../../components/Select';
import SvgIcon from '../../../../components/SvgIcon';
import styles from '../form.styl';
import { SnapmakerArtisanMachine } from '../../../../../machines';
import Modal from '../../../../components/Modal';
import { dualExtrusionPrintToolHead } from '../../../../../machines/snapmaker-2-toolheads';


const MachineSettings: React.FC = () => {
    const series = useSelector((state: RootState) => state.machine?.series);
    const toolHead = useSelector((state: RootState) => state.machine?.toolHead);
    const modules = useSelector((state: RootState) => state.machine.modules) as string[];

    const size = useSelector((state: RootState) => state.machine?.size);
    const enclosureDoorDetection = useSelector((state: RootState) => state.machine?.enclosureDoorDetection);
    const zAxisModule = useSelector((state: RootState) => state.machine?.zAxisModule);
    const connectionTimeout = useSelector((state: RootState) => state.machine?.connectionTimeout);
    const isMultiDualExtrusion = useSelector((state: RootState) => state.machine?.isMultiDualExtrusion);


    const [state, setState] = useState({
        series: '',
        size: [0, 0, 0],
        enclosureDoorDetection: false,
        zAxisModule: null,
        connectionTimeout: 3000,
        modules: modules,
    });

    // machine options
    const machineOptions = useMemo(() => getMachineOptions(), []);

    const machine = useMemo(() => {
        return findMachineByName(state.series);
    }, [state.series]);

    // tool head options
    const [printingToolHeadOptions, setPrintingToolHeadOptions] = useState([]);
    const [laserToolHeadOptions, setLaserToolHeadOptions] = useState([]);
    const [cncToolHeadOptions, setCncToolHeadOptions] = useState([]);

    const [printingToolHeadSelected, setPrintingToolHeadSelected] = useState(toolHead.printingToolhead);
    const [laserToolHeadSelected, setLaserToolHeadSelected] = useState(toolHead.laserToolhead);
    const [cncToolHeadSelected, setCncToolHeadSelected] = useState(toolHead.cncToolhead);
    const [tmpIsMultiDualExtrusion, setTmpIsMultiDualExtrusion] = useState(isMultiDualExtrusion);


    // change options when new machine series selected
    useEffect(() => {
        let printingOptions = getMachineSupportedToolOptions(state.series, HEAD_PRINTING);

        console.log('---------------isMultiDualExtrusion', isMultiDualExtrusion);
        // hard-code for artsian dualextrusion; No dualextrusion for 2.0 option by default
        if (includes([SnapmakerArtisanMachine.identifier], state.series) && !isMultiDualExtrusion) {
            printingOptions = printingOptions.filter(toolOption => toolOption.value !== dualExtrusionPrintToolHead.identifier);
        }

        setPrintingToolHeadOptions(printingOptions);

        if (printingOptions.length > 0) {
            const found = printingOptions.find(option => option.value === printingToolHeadSelected);
            if (!found) {
                setPrintingToolHeadSelected(printingOptions[0].value);
            }
        }

        const laserOptions = getMachineSupportedToolOptions(state.series, HEAD_LASER);
        setLaserToolHeadOptions(laserOptions);

        if (laserOptions.length > 0) {
            const found = laserOptions.find(option => option.value === laserToolHeadSelected);
            if (!found) {
                setLaserToolHeadSelected(laserOptions[0].value);
            }
        }

        const cncOptions = getMachineSupportedToolOptions(state.series, HEAD_CNC);
        setCncToolHeadOptions(cncOptions);

        if (cncOptions.length > 0) {
            const found = cncOptions.find(option => option.value === cncToolHeadSelected);
            if (!found) {
                setCncToolHeadSelected(cncOptions[0].value);
            }
        }
    }, [state.series, isMultiDualExtrusion]);

    // machine modules options
    const [machineModuleOptions, setMachineModuleOptions] = useState([]);
    const [isOpenArtsianDualExtrusionSelectModal, setIsOpenArtsianDualExtrusionSelectModal] = useState<boolean>(false);

    useEffect(() => {
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

            setMachineModuleOptions(options);
        } else {
            setMachineModuleOptions([]);
        }
    }, [machine]);

    const onCheckMachineModule = useCallback((checkedValues: CheckboxValueType[]) => {
        setState((previousState) => {
            return Object.assign({}, previousState, { modules: checkedValues });
        });
    }, []);

    const dispatch = useDispatch();


    const selectedArtisan = useMemo(() => {
        return includes([SnapmakerArtisanMachine.identifier], state.series);
    }, [state.series]);

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
                    <div>
                        {i18n._('There are two versions of the Dual Extrusion 3D Printing Module: one for Artisan and one for Snapmaker 2.0. If you are using the Snapmaker 2.0 version of the Dual Extrusion 3D Printing Module, be sure to activate the 3D Print Head option and save your changes.')}
                    </div>
                    <div className="margin-top-16">
                        <Checkbox
                            defaultChecked={tmpIsMultiDualExtrusion}
                            checked={tmpIsMultiDualExtrusion}
                            className="margin-right-8"
                            onChange={(event) => {
                                // hard-code for artsian dualextrusion
                                setTmpIsMultiDualExtrusion(event.target.checked);
                            }}
                        >
                            {i18n._('Enable 3D Print Head Setting')}
                        </Checkbox>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        priority="level-two"
                        type="default"
                        className="margin-right-8"
                        width="96px"
                        onClick={() => setIsOpenArtsianDualExtrusionSelectModal(false)}
                    >
                        {i18n._('Close')}
                    </Button>
                    <Button
                        priority="level-two"
                        type="primary"
                        className="align-r"
                        width="96px"
                        onClick={() => {
                            dispatch(machineActions.updateIsMultiDualExtrusion(tmpIsMultiDualExtrusion));
                            setIsOpenArtsianDualExtrusionSelectModal(false);
                        }}
                    >
                        {i18n._('Save')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    };

    const actions = {
        // Machine Model
        onChangeMachineSeries: (option) => {
            setState({
                ...state,
                series: option.value,
                // size for display, and on save/cancel it is also used for work volume construct
                size: option.machine.metadata.size,
            });
        },
        // Enclosure
        onChangeEnclosureState: (option) => {
            setState({
                ...state,
                enclosureDoorDetection: option.value
            });
        },
        // Extension z-axis module select
        onChangeZAxisModuleState: (option) => {
            setState({
                ...state,
                zAxisModule: option.value
            });
        },
        onChangeConnectionTimeoutState: (option) => {
            setState({
                ...state,
                connectionTimeout: option.value
            });
        },
        handleToolheadChange: (option, type) => {
            switch (type) {
                case 'printing':
                    setPrintingToolHeadSelected(option.value);
                    break;
                case 'laser':
                    setLaserToolHeadSelected(option.value);
                    break;
                case 'cnc':
                    setCncToolHeadSelected(option.value);
                    break;
                default:
                    break;
            }
        },
        openArtsianDualExtrusionSelectModal: () => {
            setIsOpenArtsianDualExtrusionSelectModal(true);
        }
    };
    const renderToolheadWorkSize = useCallback((_toolHeadIdentify) => {
        const _toolHead = machine?.metadata.toolHeads.find(th => th.identifier === _toolHeadIdentify);
        if (_toolHead && _toolHead.workRange) {
            const [x, y, z] = _toolHead.workRange?.max;
            let toolheadWorkSize = '';
            if (x !== machine?.metadata?.size?.x || y !== machine?.metadata?.size?.y || z !== machine?.metadata?.size?.z) {
                toolheadWorkSize = `(${x} x ${y} x ${z} mm)`;
            }
            return (<span className={classNames(styles['font-size-12'], 'margin-left-4')}>{toolheadWorkSize}</span>);
        } else {
            return '';
        }
    }, [machine]);

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            modules,
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout, modules]);

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            modules,
        });
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, [
        dispatch,
        series, connectionTimeout, size, enclosureDoorDetection, zAxisModule, modules,
    ]);

    useEffect(() => {
        setTmpIsMultiDualExtrusion(isMultiDualExtrusion);
    }, [isMultiDualExtrusion]);

    // Save changes
    const onSave = useCallback(async () => {
        dispatch(workspaceActions.connect.setConnectionTimeout(state.connectionTimeout));
        dispatch(machineActions.updateMachineSeries(state.series));
        dispatch(machineActions.updateMachineSize(state.size));
        dispatch(machineActions.setEnclosureState(state.enclosureDoorDetection));
        dispatch(machineActions.setZAxisModuleState(state.zAxisModule));
        dispatch(machineActions.updateMachineToolHead({
            printingToolhead: printingToolHeadSelected,
            laserToolhead: laserToolHeadSelected,
            cncToolhead: cncToolHeadSelected
        }, state.series));
        dispatch(machineActions.setMachineModules(state.modules));

        // save and redirect
        const headType = getCurrentHeadType(window.location.href);
        if (headType) {
            await dispatch(projectActions.clearSavedEnvironment(headType));
        }
        window.location.href = '/';
    }, [dispatch, state, printingToolHeadSelected, laserToolHeadSelected, cncToolHeadSelected]);

    const onCancel = useCallback(() => {
        setState({
            series: series,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            connectionTimeout: connectionTimeout,
            modules,
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout, modules]);

    useEffect(() => {
        UniApi.Event.on('appbar-menu:settings.save', onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', onCancel);

        return () => {
            UniApi.Event.off('appbar-menu:settings.save', onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', onCancel);
        };
    }, [onSave, onCancel]);


    return (
        <>
            <div className={styles['form-container']}>
                <div className="border-bottom-normal padding-bottom-4">
                    <SvgIcon
                        name="TitleSetting"
                        type={['static']}
                    />
                    <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Machine')}</span>
                </div>
                <Select
                    className="margin-vertical-16"
                    searchable={false}
                    size="200px"
                    name="select-machine"
                    options={machineOptions}
                    value={state.series}
                    onChange={actions.onChangeMachineSeries}
                />
                <div>
                    <span className="unit-text margin-right-12">{i18n._('key-App/Settings/MachineSettings-Dimensions')}:</span>
                    <span className="main-text-normal">{`${machine?.metadata?.size?.x} x ${machine?.metadata?.size?.y} x ${machine?.metadata?.size?.z} mm`} </span>
                </div>
                <div className="border-bottom-normal padding-bottom-4 margin-top-32">
                    <SvgIcon
                        name="TitleSetting"
                        type={['static']}
                    />
                    <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Head')}</span>
                </div>
                <div className={styles['head-detail']}>
                    {
                        printingToolHeadOptions.length > 0 && (
                            <div className="margin-bottom-16">
                                <div className="main-text-normal margin-bottom-8 margin-top-16">
                                    {i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}
                                    {renderToolheadWorkSize(printingToolHeadSelected)}
                                </div>
                                <Select
                                    value={printingToolHeadSelected}
                                    options={printingToolHeadOptions.map(item => {
                                        return {
                                            value: item.value,
                                            label: item.label,
                                        };
                                    })}
                                    onChange={e => actions.handleToolheadChange(e, 'printing')}
                                    size="large"
                                    disabled={printingToolHeadOptions.length <= 1}
                                />
                                {
                                    selectedArtisan && <i onClick={actions.openArtsianDualExtrusionSelectModal} className="fa fa-info-circle margin-left-8 cursor-pointer" aria-hidden="true" />
                                }
                            </div>
                        )
                    }
                    {
                        laserToolHeadOptions.length > 0 && (
                            <div className="margin-bottom-16">
                                <div className="main-text-normal margin-bottom-8">{i18n._('key-App/Settings/MachineSettings-Laser Toolhead')}</div>
                                <Select
                                    value={laserToolHeadSelected}
                                    options={laserToolHeadOptions.map(item => {
                                        return {
                                            value: item.value,
                                            label: i18n._(item.label)
                                        };
                                    })}
                                    onChange={e => actions.handleToolheadChange(e, 'laser')}
                                    size="large"
                                    disabled={laserToolHeadOptions.length <= 1}
                                />
                            </div>

                        )
                    }
                    {
                        cncToolHeadOptions.length > 0 && (
                            <div className="margin-bottom-16">
                                <div className="main-text-normal margin-bottom-8">{i18n._('key-App/Settings/MachineSettings-CNC Toolhead')}</div>
                                <Select
                                    value={cncToolHeadSelected}
                                    options={cncToolHeadOptions.map(item => ({
                                        value: item.value,
                                        label: i18n._(item.label)
                                    }))}
                                    onChange={e => actions.handleToolheadChange(e, 'cnc')}
                                    size="large"
                                    disabled={cncToolHeadOptions.length <= 1}
                                />
                            </div>

                        )
                    }
                </div>

                {
                    machineModuleOptions.length > 0 && (
                        <div className="border-bottom-normal padding-bottom-4 margin-top-32">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                            />
                            <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Modules')}</span>
                        </div>
                    )
                }

                {
                    machineModuleOptions.length > 0 && (
                        <div className={classNames(styles['head-detail'], 'margin-top-8')}>
                            <div className="margin-bottom-16">
                                <Checkbox.Group
                                    options={machineModuleOptions}
                                    onChange={onCheckMachineModule}
                                    defaultValue={state.modules}
                                />
                            </div>
                        </div>
                    )
                }
            </div>
            {isOpenArtsianDualExtrusionSelectModal && renderArtsianDualExtrusionSelectModal()}
        </>
    );
};

export default MachineSettings;
