import classNames from 'classnames';
import { MachineType } from '@snapmaker/luban-platform';
import { find, includes, remove } from 'lodash';
import PropTypes from 'prop-types';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { HEAD_PRINTING, LEFT, RIGHT } from '../../../constants';
import {
    findMachineByName,
    getMachineOptions,
    getMachineSupportedToolOptions,
    isDualExtruder,
    MACHINE_SERIES
} from '../../../constants/machines';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import { getCurrentHeadType } from '../../../lib/url-utils';
import { machineStore } from '../../../store/local-storage';
import Anchor from '../../components/Anchor';
import { Badge } from '../../components/Badge';
import { NumberInput as Input } from '../../components/Input';
import SvgIcon from '../../components/SvgIcon';

import styles from './styles.styl';


const defaultNozzleDiameterList = [{
    value: 0.2,
    label: '0.2',
    isDefault: true
}, {
    value: 0.4,
    label: '0.4',
    isDefault: true
}, {
    value: 0.6,
    label: '0.6',
    isDefault: true
}, {
    value: 0.8,
    label: '0.8',
    isDefault: true
}];
const defaultNozzleDiameterListForSingleExtruder = [{
    value: 0.4,
    label: '0.4',
    isDefault: true
}];
const defaultNozzleDiameterListForDualExtruder = [{
    value: 0.2,
    label: '0.2',
    isDefault: true
}, {
    value: 0.4,
    label: '0.4',
    isDefault: true
}, {
    value: 0.4,
    label: '0.4H',
    isDefault: true
}, {
    value: 0.6,
    label: '0.6',
    isDefault: true
}, {
    value: 0.8,
    label: '0.8',
    isDefault: true
}];
const MachineSettings = forwardRef(({
    series,
    toolMap,
    connectSerial,
    connectMachineName = 'Manual',
    isConnected,
    setSeries,
    setToolhead
}, ref) => {
    // const extruderLDefinition = useSelector((state) => state?.printing?.extruderLDefinition);
    // const extruderRDefinition = useSelector((state) => state?.printing?.extruderRDefinition);
    const {
        extruderLDefinition,
        extruderRDefinition,
    } = useSelector(state => state.printing);

    const defaultLeftDiameter = useSelector(
        (state) => state.printing?.extruderLDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );
    const defaultRightDiameter = useSelector(
        (state) => state.printing?.extruderRDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );

    const dispatch = useDispatch();

    // head type
    const [headType, setHeadType] = useState(HEAD_PRINTING);
    useEffect(() => {
        // FIXME: Only printing is allowed on this page
        setHeadType(getCurrentHeadType(window.location.href));
    }, []);

    const [selectedMachineSeries, setSelectedMachineSeries] = useState(series);
    const [selectedToolName, setSelectedToolName] = useState(toolMap[`${headType}Toolhead`]);
    const [leftNozzleDiameter, setLeftNozzleDiameter] = useState(defaultLeftDiameter);
    const [rightNozzleDiameter, setRightNozzleDiameter] = useState(defaultRightDiameter);
    const [activeNozzle, setActiveNozzle] = useState(LEFT);

    // for original long zAxis
    const [zAxis, setZAxis] = useState(series === MACHINE_SERIES.ORIGINAL_LZ.identifier);
    const [leftNozzleDiameterList, setLeftNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [rightNozzleDiameterList, setRightNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [addDiameterStatus, setAddDiameterStatus] = useState(false);

    // Window resize
    const resizeAction = () => {
        const ele = document.getElementById('machine-list');
        if (ele) {
            if (window.innerWidth < 1440) {
                ele.className = 'overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 grid-template-row-for-machine-settings grid-template-columns-for-machine-settings-small-screen width-all-minus-328';
            } else if (window.innerWidth <= 1920) {
                ele.className = 'overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 grid-template-row-for-machine-settings grid-template-columns-for-machine-settings width-all-minus-328';
            } else {
                ele.className = 'overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 grid-template-row-for-machine-settings-large-screen grid-template-columns-for-machine-settings-large-screen width-all-minus-328';
            }
        }
    };
    useEffect(() => {
        window.addEventListener('resize', () => resizeAction());
        return () => {
            window.removeEventListener('resize', () => resizeAction());
        };
    }, []);


    // Handles
    const handleAddDiameter = (status) => {
        setAddDiameterStatus(status);
    };

    const getActiveDiameter = (direction, list) => {
        let machineNozzleSize;
        const nozzleDiameterList = list;
        if (direction === LEFT) {
            machineNozzleSize = extruderLDefinition?.settings?.machine_nozzle_size.default_value;
        } else {
            machineNozzleSize = extruderRDefinition?.settings?.machine_nozzle_size.default_value;
        }

        let activeDiameter = nozzleDiameterList.find((d) => {
            return d.value === machineNozzleSize;
        });

        if (!activeDiameter) {
            activeDiameter = nozzleDiameterList.find(d => d.value === 0.4);
        }

        if (!activeDiameter) {
            activeDiameter = nozzleDiameterList[0];
        }

        return activeDiameter;
    };

    /**
     * On change nozzle.
     */
    const onChangeDiameter = (direction, nozzle) => {
        if (!nozzle) {
            return;
        }
        if (direction === LEFT) {
            setLeftNozzleDiameter(nozzle.label);
        } else {
            setRightNozzleDiameter(nozzle.label);
        }
        const newNozzleSize = Number(nozzle.value);

        const def = direction === LEFT ? extruderLDefinition : extruderRDefinition;
        const oldNozzleSize = def?.settings?.machine_nozzle_size?.default_value;
        if (oldNozzleSize && oldNozzleSize !== newNozzleSize) {
            dispatch(
                printingActions.updateMachineDefinition({
                    paramKey: 'machine_nozzle_size',
                    paramValue: newNozzleSize,
                    direction,
                })
            );
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        }
    };

    const saveDiameterToStorage = (direction, label, isDelete = false) => {
        const key = `customNozzleDiameter.${selectedToolName}.${selectedMachineSeries}.${direction}`;
        const str = machineStore.get(key) || '[]';
        let configs = JSON.parse(str);
        if (isDelete) {
            configs = configs.filter(i => `${i}` !== `${label}`);
        } else {
            configs.push(label);
        }
        machineStore.set(key, JSON.stringify(configs));
    };
    const handleRemoveDiameter = (e, label, direction) => {
        e.stopPropagation();
        if (direction === LEFT) {
            const newLeftList = remove(leftNozzleDiameterList, (list) => {
                return list.label !== label;
            });
            setLeftNozzleDiameterList(newLeftList);
        } else {
            const newRightList = remove(rightNozzleDiameterList, (list) => {
                return list.label !== label;
            });
            setRightNozzleDiameterList(newRightList);
        }
        saveDiameterToStorage(direction, label, true);
    };
    const AddDiameterToList = (e, direction) => {
        const newValue = e.target.value;
        if (!newValue) {
            setAddDiameterStatus(false);
            return;
        }
        let newDiameter = Number(newValue);
        if (newDiameter < 0.1) newDiameter = 0.1;
        if (newDiameter > 1.2) newDiameter = 1.2;
        newDiameter = Math.floor(newDiameter * 100) / 100;
        const label = `${newDiameter}`;
        if (direction === LEFT) {
            if (!find(leftNozzleDiameterList, { label })) {
                setLeftNozzleDiameterList([...leftNozzleDiameterList, {
                    label,
                    value: newDiameter,
                    isDefault: false
                }]);
                saveDiameterToStorage(direction, label);
            }
            setLeftNozzleDiameter(label);
        } else {
            if (!find(rightNozzleDiameterList, { label })) {
                setRightNozzleDiameterList([...rightNozzleDiameterList, {
                    label,
                    value: newDiameter,
                    isDefault: false
                }]);
                saveDiameterToStorage(direction, label);
            }
            setRightNozzleDiameter(label);
        }
        setAddDiameterStatus(false);
        onChangeDiameter(direction, {
            label,
            value: newDiameter
        });
    };

    const getNozzleDiameterFromStorage = (direction, _selectedMachineSeries) => {
        const key = `customNozzleDiameter.${selectedToolName}.${_selectedMachineSeries}.${direction}`;
        const str = machineStore.get(key) || '[]';
        const configs = JSON.parse(str);
        return configs.map((value) => {
            return {
                value: Number(value),
                label: `${value}`,
                isDefault: false
            };
        });
    };

    const checkNozzleDiameter = (direction, list) => {
        const activeNozzleSize = getActiveDiameter(direction, list);
        onChangeDiameter(direction, activeNozzleSize);
    };

    const _setNozzleDiameterList = (direction, _defaultNozzleDiameterList, _selectedMachineSeries) => {
        if (direction === LEFT) {
            const list = [..._defaultNozzleDiameterList, ...getNozzleDiameterFromStorage(LEFT, _selectedMachineSeries)];
            setLeftNozzleDiameterList(list);
            checkNozzleDiameter(LEFT, list);
        } else {
            const list = [..._defaultNozzleDiameterList, ...getNozzleDiameterFromStorage(RIGHT, _selectedMachineSeries)];
            setRightNozzleDiameterList(list);
            checkNozzleDiameter(RIGHT, list);
        }
    };

    const handleMachineUpdate = (value) => {
        setSelectedMachineSeries(value);
        setActiveNozzle(LEFT);
        // if (value === MACHINE_SERIES.ORIGINAL.identifier) {
        //     setSelectedToolName(SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL);
        //     setZAxis(false);
        // } else {
        //     setSelectedToolName(SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2);
        // }
    };

    const selectedMachine = useMemo(() => {
        return findMachineByName(selectedMachineSeries);
    }, [selectedMachineSeries]);

    const is3DPrinter = selectedMachine.machineType === MachineType.Printer;
    const isMultiFunctionMachine = selectedMachine.machineType === MachineType.MultiFuncionPrinter;

    const switchToolHead = (option) => {
        setSelectedToolName(option.value);
        setActiveNozzle(LEFT);
    };

    useImperativeHandle(ref, () => ({
        checkNozzleDiameter: () => {
            // checkNozzleDiameter(LEFT, leftNozzleDiameterList);
            // checkNozzleDiameter(RIGHT, rightNozzleDiameterList);
        }
    }));

    // Once available tool head changed, update selected tool head as well
    useEffect(() => {
        if (selectedToolName !== toolMap[`${headType}Toolhead`]) {
            setSelectedToolName(toolMap[`${headType}Toolhead`]);
        }
    }, [toolMap, headType]);

    useEffect(() => {
        // update machine series
        setSeries(selectedMachineSeries);

        // update tool head
        setToolhead({
            ...toolMap,
            [`${headType}Toolhead`]: selectedToolName
        });

        // update nozzle variants
        // TODO: Get available variants from tool head definition.
        if (isDualExtruder(selectedToolName)) {
            _setNozzleDiameterList(LEFT, defaultNozzleDiameterListForDualExtruder, selectedMachineSeries);
            _setNozzleDiameterList(RIGHT, defaultNozzleDiameterListForDualExtruder, selectedMachineSeries);
        } else {
            _setNozzleDiameterList(LEFT, defaultNozzleDiameterListForSingleExtruder, selectedMachineSeries);
            setRightNozzleDiameterList([]);
        }
    }, [selectedMachineSeries, selectedToolName]);

    const machineOptions = useMemo(() => getMachineOptions(), []);

    // TODO: Make it a state?
    const availableToolOptions = useMemo(() => {
        return getMachineSupportedToolOptions(selectedMachineSeries, headType);
    }, [selectedMachineSeries, headType]);

    return (
        <div className="sm-flex padding-vertical-40 padding-horizontal-40 justify-space-between height-all-minus-60">
            <div
                id="machine-list"
                className={`overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60
                    ${window.innerWidth > 1360 ? 'grid-template-columns-for-machine-settings' : 'grid-template-columns-for-machine-settings-small-screen'}
                    grid-template-row-for-machine-settings width-all-minus-328`}
            >
                {
                    machineOptions.map(item => {
                        const machine = item.machine;
                        const isCurrent = selectedMachineSeries === item.value;

                        return (
                            <Anchor
                                key={item.value}
                                onClick={() => handleMachineUpdate(item.value)}
                                className="padding-vertical-16 padding-horizontal-16"
                            >
                                <div className="width-percent-100 height-percent-100">
                                    <div
                                        className={`width-percent-100 position-re ${isCurrent ? 'border-radius-16 border-blod-blue-2' : ''}`}
                                        style={{ height: 'calc(100% - 22px)' }}
                                    >
                                        <img
                                            src={machine.img}
                                            alt={item.value}
                                            draggable={false}
                                            className="width-percent-100 border-radius-16 height-percent-100 display-block margin-auto"
                                        />
                                        {(isConnected && includes(connectSerial, item.value)) && (
                                            <div className="position-absolute bottom-2 right-1 background-grey-3 border-radius-8 font-size-small padding-vertical-4 padding-horizontal-8 line-height-14">
                                                <Badge status="success" />
                                                <span>online</span>
                                                <span className="max-width-106 text-overflow-ellpsis">{connectMachineName ? ` | ${connectMachineName}` : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="heading-3 align-c text-overflow-ellipsis width-percent-100">
                                        {i18n._(item.label)}
                                    </div>
                                </div>
                            </Anchor>
                        );
                    })
                }
            </div>
            <div className="width-296 background-grey-3 border-radius-24 padding-vertical-32 padding-horizontal-24">
                {
                    (selectedMachineSeries === MACHINE_SERIES.ORIGINAL.identifier || selectedMachineSeries === MACHINE_SERIES.ORIGINAL_LZ.identifier) && (
                        <div>
                            <div className="heading-3 margin-bottom-16">{i18n._('key-settings/Z-axis Module')}</div>
                            <div className="sm-flex justify-space-between">
                                <Anchor onClick={() => {
                                    setZAxis(false);
                                    setSelectedMachineSeries(MACHINE_SERIES.ORIGINAL.identifier);
                                }}
                                >
                                    <div className={`width-116 height-116 border-radius-8 ${zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                        <img src="/resources/images/machine/z_axis_standard.png" draggable={false} alt="" className="width-percent-100" />
                                    </div>
                                    <div className="align-c">{i18n._('key-settings/Z-axis Standard')}</div>
                                </Anchor>
                                <Anchor onClick={() => {
                                    setZAxis(true);
                                    setSelectedMachineSeries(MACHINE_SERIES.ORIGINAL_LZ.identifier);
                                }}
                                >
                                    <div className={`width-116 height-116 border-radius-8 ${!zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                        <img src="/resources/images/machine/z_axis_extension.png" draggable={false} alt="" className="width-percent-100" />
                                    </div>
                                    <div className="align-c">{i18n._('key-settings/Z-axis Extension')}</div>
                                </Anchor>
                            </div>
                        </div>
                    )
                }
                {
                    availableToolOptions.length > 0 && (
                        <div>
                            <div className={`heading-3 ${(includes([MACHINE_SERIES.ORIGINAL.identifier, MACHINE_SERIES.ORIGINAL_LZ.identifier], selectedMachineSeries)) ? 'margin-top-32' : ''} margin-bottom-16`}>
                                {i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}
                            </div>
                            <div className="sm-flex">
                                {
                                    availableToolOptions.map((option, index) => {
                                        const tool = option.tool;
                                        return (
                                            <Anchor
                                                key={option.value}
                                                onClick={() => {
                                                    switchToolHead(option);
                                                }}
                                                className={`${index === 0 ? 'margin-right-16' : ''}`}
                                            >
                                                <div className={`width-116 height-116 border-radius-8 border-default-grey-1 ${selectedToolName === option.value ? 'border-color-blue-2' : ''}`}>
                                                    <img src={tool.image} draggable={false} alt="" className="width-percent-100" />
                                                </div>
                                                <div className="align-c">{i18n._(`${option.label}`)}</div>
                                            </Anchor>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )
                }
                {
                    headType === HEAD_PRINTING && (is3DPrinter || isMultiFunctionMachine) && (
                        <div className="margin-top-32">
                            <div>{i18n._('key-settings/Nozzle Diameter')} (mm)</div>
                            {/* Nozzle Diameter */}
                            {
                                isDualExtruder(selectedToolName) && (
                                    <div className="margin-top-16 width-248 height-32 background-grey-2 padding-2 border-radius-8">
                                        <Anchor className={`padding-left-8 border-radius-8 width-122 display-inline ${activeNozzle === LEFT ? 'background-color-white' : ''}`} onClick={() => setActiveNozzle(LEFT)}>
                                            <span className="margin-right-8">{i18n._('key-settings/Nozzle Diameter Left')}</span>
                                            <span>{leftNozzleDiameter}</span>
                                        </Anchor>
                                        <Anchor className={`padding-left-8 border-radius-8 width-122 display-inline ${activeNozzle === RIGHT ? 'background-color-white' : ''}`} onClick={() => setActiveNozzle(RIGHT)}>
                                            <span className="margin-right-8">{i18n._('key-settings/Nozzle Diameter Right')}</span>
                                            <span>{rightNozzleDiameter}</span>
                                        </Anchor>
                                    </div>
                                )
                            }
                            {
                                activeNozzle === LEFT && (
                                    <div className="sm-flex sm-flex-wrap margin-top-16">
                                        {
                                            leftNozzleDiameterList.map((nozzle, index) => {
                                                return (
                                                    <Anchor
                                                        key={nozzle.label}
                                                        onClick={() => onChangeDiameter(LEFT, nozzle)}
                                                        className={classNames(
                                                            styles['diameter-item-wrapper'],
                                                            'margin-bottom-8 width-56 padding-horizontal-8 height-32 border-radius-8 border-default-grey-1',
                                                            {
                                                                'border-color-blue-2': leftNozzleDiameter === nozzle.label,
                                                                'margin-right-8': index % 4 !== 3,
                                                            }
                                                        )}
                                                    >
                                                        <div className={classNames(styles['diameter-item'], 'sm-flex justify-space-between')}>
                                                            <span>{nozzle.label}</span>
                                                            {
                                                                !nozzle.isDefault && `${leftNozzleDiameter}` !== nozzle.label && (
                                                                    <SvgIcon
                                                                        name="Cancel"
                                                                        size={8}
                                                                        type={['static']}
                                                                        className={styles['close-icon']}
                                                                        onClick={(e) => handleRemoveDiameter(e, nozzle.label, LEFT)}
                                                                    />
                                                                )
                                                            }
                                                        </div>
                                                    </Anchor>
                                                );
                                            })
                                        }
                                        {
                                            leftNozzleDiameterList.length < 8 && (
                                                <Anchor
                                                    onClick={() => handleAddDiameter(true)}
                                                    className={(classNames(addDiameterStatus ? 'border-blue-2' : 'padding-left-8 border-dashed-grey-1', 'width-56 height-32 border-radius-8', styles['add-nozzle-diameter-input']))}
                                                >
                                                    {
                                                        addDiameterStatus ? (
                                                            <Input
                                                                min={0.1}
                                                                max={1.2}
                                                                decimalPlaces={2}
                                                                bordered={false}
                                                                size="super-small"
                                                                autoFocus
                                                                placeholder="Add"
                                                                onPressEnter={e => AddDiameterToList(e, LEFT)}
                                                                onBlur={e => AddDiameterToList(e, LEFT)}
                                                                formatter={(value) => {
                                                                    const newValue = Math.round(Number(value) * 100) / 100;
                                                                    return newValue;
                                                                }}
                                                            />
                                                        ) : (
                                                            <span>
                                                                + {i18n._('key-Settings/Nozazle-Add')}
                                                            </span>
                                                        )
                                                    }
                                                </Anchor>
                                            )
                                        }
                                    </div>
                                )
                            }
                            {
                                activeNozzle === RIGHT && (
                                    <div className="sm-flex sm-flex-wrap margin-top-16">
                                        {
                                            rightNozzleDiameterList.map((nozzle, index) => {
                                                return (
                                                    <Anchor
                                                        key={nozzle.label}
                                                        onClick={() => onChangeDiameter(RIGHT, nozzle)}
                                                        className={classNames(
                                                            styles['diameter-item-wrapper'],
                                                            'margin-bottom-8 width-56 padding-horizontal-8 height-32 border-radius-8 border-default-grey-1',
                                                            {
                                                                'border-color-blue-2': leftNozzleDiameter === nozzle.label,
                                                                'margin-right-8': index % 4 !== 3,
                                                            }
                                                        )}
                                                    >
                                                        <div className="sm-flex justify-space-between ">
                                                            <span>{nozzle.label}</span>
                                                            {
                                                                !nozzle.isDefault && `${rightNozzleDiameter} ` !== nozzle.label && (
                                                                    <SvgIcon
                                                                        name="Cancel"
                                                                        size={8}
                                                                        type={['static']}
                                                                        className={styles['close-icon']}
                                                                        onClick={(e) => handleRemoveDiameter(e, nozzle.label, RIGHT)}
                                                                    />
                                                                )
                                                            }
                                                        </div>
                                                    </Anchor>
                                                );
                                            })
                                        }
                                        {
                                            rightNozzleDiameterList.length < 8 && (
                                                <Anchor className={(classNames(addDiameterStatus ? '' : 'padding-left-8', 'width-56 height-32 border-radius-8 border-dashed-grey-1'))} onClick={() => handleAddDiameter(true)}>
                                                    {
                                                        addDiameterStatus ? (
                                                            <Input
                                                                min={0.1}
                                                                max={1.2}
                                                                decimalPlaces={2}
                                                                bordered={false}
                                                                size="super-small"
                                                                autoFocus
                                                                placeholder="Add"
                                                                onPressEnter={e => AddDiameterToList(e, RIGHT)}
                                                                onBlur={e => AddDiameterToList(e, RIGHT)}
                                                                formatter={(value) => {
                                                                    const newValue = Math.round(Number(value) * 100) / 100;
                                                                    return newValue;
                                                                }}
                                                            />
                                                        ) : (
                                                            <span>
                                                                + {i18n._('key-Settings/Nozazle-Add')}
                                                            </span>
                                                        )
                                                    }
                                                </Anchor>
                                            )
                                        }
                                    </div>
                                )
                            }
                        </div>
                    )
                }
            </div>
        </div>
    );
});

MachineSettings.propTypes = {
    series: PropTypes.string.isRequired,
    toolMap: PropTypes.object,
    connectSerial: PropTypes.string,
    connectMachineName: PropTypes.string,
    // nozzleDiameter: PropTypes.number,
    isConnected: PropTypes.bool,
    setSeries: PropTypes.func,
    setToolhead: PropTypes.func
};

export default MachineSettings;
