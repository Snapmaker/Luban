import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { find, includes, remove } from 'lodash';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import {
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, PRINTING_MANAGER_TYPE_EXTRUDER, getCurrentHeadType, HEAD_CNC, HEAD_LASER, HEAD_PRINTING, LEVEL_ONE_POWER_LASER_FOR_ORIGINAL, LEVEL_ONE_POWER_LASER_FOR_SM2, LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2, LEVEL_TWO_POWER_LASER_FOR_SM2, MACHINE_SERIES, MACHINE_TOOL_HEADS, PRINTING_SINGLE_EXTRUDER_HEADTOOL, SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL, SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2, STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL, STANDARD_CNC_TOOLHEAD_FOR_SM2,
    LEFT, RIGHT
} from '../../../constants';
import SvgIcon from '../../components/SvgIcon';
import { NumberInput as Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { actions as printingActions } from '../../../flux/printing';
import { machineStore } from '../../../store/local-storage';
import styles from './styles.styl';

const machineList = [{
    value: 'Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
    image: '/resources/images/machine/size-1.0-original.jpg',
}, {
    value: 'A150',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150',
    image: '/resources/images/machine/size-2.0-A150.png'
}, {
    value: 'A250',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250',
    image: '/resources/images/machine/size-2.0-A250.png'
}, {
    value: 'A350',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350',
    image: '/resources/images/machine/size-2.0-A350.jpg'
}, {
    value: 'A400',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker 2.0 A400',
    image: '/resources/images/machine/size-2.0-A400.jpeg'
}];

const toolHeadMap = {
    [MACHINE_SERIES.ORIGINAL.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_3dp.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_cnc.png'
        }]
    },
    [MACHINE_SERIES.ORIGINAL_LZ.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_3dp.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].label,
            image: '/resources/images/machine/original_cnc.png'
        }]
    },
    [MACHINE_SERIES.A150.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A250.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A350.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }]
    },
    [MACHINE_SERIES.A400.value]: {
        [HEAD_PRINTING]: [{
            value: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/printing_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }],
        [HEAD_LASER]: [{
            value: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/1600mw_laser.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_POWER_LASER_FOR_SM2].label,
            image: '/resources/images/machine/10w_laser.png'
        }],
        [HEAD_CNC]: [{
            value: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/cnc_2.png'
        }, {
            value: MACHINE_TOOL_HEADS[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2].value,
            label: MACHINE_TOOL_HEADS[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2].label,
            image: '/resources/images/machine/coming_soon.png'
        }]
    },
};
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
const defaultNozzleDiameterListForDualExtruderArtisan = [{
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
const defaultNozzleDiameterListForDualExtruder = [{
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
const MachineSettings = forwardRef(({
    serial,
    toolHead,
    connectSerial,
    connectMachineName = 'Manual',
    leftNozzleDiameter: defaultLeftDiameter,
    rightNozzleDiameter: defaultRightDiameter,
    // hasZAxis, // for original long zAxis
    isConnected,
    setSeries,
    setToolhead
}, ref) => {
    const extruderLDefinition = useSelector((state) => state?.printing?.extruderLDefinition);
    const extruderRDefinition = useSelector((state) => state?.printing?.extruderRDefinition);
    const [headType, setHeadType] = useState(HEAD_PRINTING);
    const [currentSerial, setCurrentSerial] = useState(serial);
    const [currentToolHead, setCurrentToolHead] = useState(toolHead[`${headType}Toolhead`]);
    const [leftNozzleDiameter, setLeftNozzleDiameter] = useState(defaultLeftDiameter);
    const [rightNozzleDiameter, setRightNozzleDiameter] = useState(defaultRightDiameter);
    const [activeNozzle, setActiveNozzle] = useState(LEFT);
    const dispatch = useDispatch();

    useEffect(() => {
        setCurrentToolHead(toolHead[`${headType}Toolhead`]);
    }, [toolHead, headType]);

    // for original long zAxis
    const [zAxis, setZAxis] = useState(serial === MACHINE_SERIES.ORIGINAL_LZ.value);
    const [leftNozzleDiameterList, setLeftNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [rightNozzleDiameterList, setRightNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [addDiameterStatus, setAddDiameterStatus] = useState(false);
    const handleMachineUpdate = (value) => {
        setActiveNozzle(LEFT);
        setCurrentSerial(value);
        if (value === MACHINE_SERIES.ORIGINAL.value) {
            setCurrentToolHead(SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL);
            setZAxis(false);
        } else {
            setCurrentToolHead(SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2);
        }
    };
    const handleAddDiameter = (status) => {
        setAddDiameterStatus(status);
    };
    const getActiveDiameter = (direction, list) => {
        const key = `customNozzleDiameter.${currentToolHead}.${currentSerial}.${direction}_active`;
        const cacheLabel = machineStore.get(key);
        let machineNozzleSize;
        const nozzleDiameterList = list;
        if (direction === LEFT) {
            machineNozzleSize = extruderLDefinition?.settings?.machine_nozzle_size.default_value;
        } else {
            machineNozzleSize = extruderRDefinition?.settings?.machine_nozzle_size.default_value;
        }
        let activeDiameter = nozzleDiameterList.find((d) => {
            return d.label === cacheLabel;
        });
        if (!activeDiameter) {
            activeDiameter = nozzleDiameterList.find((d) => {
                return d.value === machineNozzleSize;
            });
        }
        if (!activeDiameter) {
            activeDiameter = nozzleDiameterList[0];
        }
        if (direction === LEFT && activeDiameter) {
            dispatch(printingActions.updateDefaultDefinition('quality.normal_other_quality', activeDiameter.value));
        }

        return activeDiameter;
    };
    const saveActiveDiameterToStorage = (direction, label) => {
        const key = `customNozzleDiameter.${currentToolHead}.${currentSerial}.${direction}_active`;

        machineStore.set(key, label);
    };
    const onChangeDiameter = (direction, nozzle) => {
        if (!nozzle) {
            return;
        }
        if (direction === LEFT) {
            setLeftNozzleDiameter(nozzle.label);
        } else {
            setRightNozzleDiameter(nozzle.label);
        }
        const def = direction === LEFT
            ? extruderLDefinition
            : extruderRDefinition;
        const oldNozzleSize = def?.settings?.machine_nozzle_size?.default_value;
        if (oldNozzleSize && oldNozzleSize !== nozzle?.value) {
            def.settings.machine_nozzle_size.default_value = Number(nozzle.value);
            saveActiveDiameterToStorage(direction, nozzle.label);
            dispatch(
                printingActions.updateCurrentDefinition({
                    definitionModel: def,
                    managerDisplayType: PRINTING_MANAGER_TYPE_EXTRUDER,
                    direction
                })
            );
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        }
    };

    const saveDiameterToStorage = (direction, label, isDelete = false) => {
        const key = `customNozzleDiameter.${currentToolHead}.${currentSerial}.${direction}`;
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
        const currentHeadType = getCurrentHeadType(window.location.href);
        setHeadType(currentHeadType);
        return () => {
            window.removeEventListener('resize', () => resizeAction());
        };
    }, []);

    const getNozzleDiameterFromStorage = (direction, _currentSerial) => {
        const key = `customNozzleDiameter.${currentToolHead}.${_currentSerial}.${direction}`;
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

    const _setNozzleDiameterList = (direction, _defaultNozzleDiameterList, _currentSerial) => {
        if (direction === LEFT) {
            const list = [..._defaultNozzleDiameterList, ...getNozzleDiameterFromStorage(LEFT, _currentSerial)];
            setLeftNozzleDiameterList(list);
            checkNozzleDiameter(LEFT, list);
        } else {
            const list = [..._defaultNozzleDiameterList, ...getNozzleDiameterFromStorage(RIGHT, _currentSerial)];
            setRightNozzleDiameterList(list);
            checkNozzleDiameter(RIGHT, list);
        }
    };

    useEffect(() => {
        setSeries(currentSerial);
        let tempToolhead = { ...toolHead };
        if (currentSerial === MACHINE_SERIES.ORIGINAL.value) {
            const markForOrigin = 'ForOriginal';
            tempToolhead = {
                printingToolhead: includes(toolHead.printToolhead, markForOrigin) ? toolHead.printToolhead : SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
                laserToolhead: includes(toolHead.laserToolhead, markForOrigin) ? toolHead.laserToolhead : LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
                cncToolhead: includes(toolHead.cncToolhead, markForOrigin) ? toolHead.cncToolhead : STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL
            };
        } else {
            const markForSM2 = 'ForSM2';
            tempToolhead = {
                printingToolhead: includes(toolHead.printToolhead, markForSM2) ? toolHead.printToolhead : SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
                laserToolhead: includes(toolHead.laserToolhead, markForSM2) ? toolHead.laserToolhead : LEVEL_ONE_POWER_LASER_FOR_SM2,
                cncToolhead: includes(toolHead.cncToolhead, markForSM2) ? toolHead.cncToolhead : STANDARD_CNC_TOOLHEAD_FOR_SM2
            };
        }
        setToolhead({
            ...tempToolhead,
            [`${headType}Toolhead`]: currentToolHead
        });
        if (currentToolHead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            switch (currentSerial) {
                case MACHINE_SERIES.A400.value:
                    _setNozzleDiameterList(LEFT, defaultNozzleDiameterListForDualExtruderArtisan, currentSerial);
                    _setNozzleDiameterList(RIGHT, defaultNozzleDiameterListForDualExtruderArtisan, currentSerial);
                    break;
                default:
                    _setNozzleDiameterList(LEFT, defaultNozzleDiameterListForDualExtruder, currentSerial);
                    _setNozzleDiameterList(RIGHT, defaultNozzleDiameterListForDualExtruder, currentSerial);
                    break;
            }
        } else if (includes(PRINTING_SINGLE_EXTRUDER_HEADTOOL, currentToolHead)) {
            _setNozzleDiameterList(LEFT, defaultNozzleDiameterListForSingleExtruder, currentSerial);
            setRightNozzleDiameterList([]);
        }
    }, [currentSerial, currentToolHead, extruderLDefinition?.settings?.machine_nozzle_size?.default_value, extruderRDefinition?.settings?.machine_nozzle_size?.default_value]);

    const switchToolHead = (toolHeadItem) => {
        setCurrentToolHead(toolHeadItem.value);
        setActiveNozzle(LEFT);
    };

    useImperativeHandle(ref, () => ({
        checkNozzleDiameter: () => {
            checkNozzleDiameter(LEFT, leftNozzleDiameterList);
            checkNozzleDiameter(RIGHT, rightNozzleDiameterList);
        }
    }));

    return (
        <div className="sm-flex padding-vertical-40 padding-horizontal-40 justify-space-between height-all-minus-60">
            <div id="machine-list" className={`overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 ${window.innerWidth > 1360 ? 'grid-template-columns-for-machine-settings' : 'grid-template-columns-for-machine-settings-small-screen'} grid-template-row-for-machine-settings width-all-minus-328`}>
                {
                    machineList.map(item => {
                        return (
                            <Anchor
                                onClick={() => handleMachineUpdate(item.value)}
                                key={item.value}
                                className="padding-vertical-16 padding-horizontal-16"
                            >
                                <div className="width-percent-100 height-percent-100">
                                    <div className={`width-percent-100 position-re ${includes(currentSerial, item.value) ? 'border-radius-16 border-blod-blue-2' : ''}`} style={{ height: 'calc(100% - 22px)' }}>
                                        <img src={item.image} alt="" draggable={false} className="width-percent-100 border-radius-16 height-percent-100 display-block margin-auto" />
                                        {(isConnected && includes(connectSerial, item.value)) && (
                                            <div className="position-ab bottom-2 right-1 background-grey-3 border-radius-8 font-size-small padding-vertical-4 padding-horizontal-8 line-height-14">
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
                {(currentSerial === MACHINE_SERIES.ORIGINAL.value || currentSerial === MACHINE_SERIES.ORIGINAL_LZ.value) && (
                    <div>
                        <div className="heading-3 margin-bottom-16">{i18n._('key-settings/Z-axis Module')}</div>
                        <div className="sm-flex justify-space-between">
                            <Anchor onClick={() => {
                                setZAxis(false);
                                setCurrentSerial(MACHINE_SERIES.ORIGINAL.value);
                            }}
                            >
                                <div className={`width-116 height-116 border-radius-8 ${zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                    <img src="/resources/images/machine/z_axis_standard.png" draggable={false} alt="" className="width-percent-100" />
                                </div>
                                <div className="align-c">{i18n._('key-settings/Z-axis Standard')}</div>
                            </Anchor>
                            <Anchor onClick={() => {
                                setZAxis(true);
                                setCurrentSerial(MACHINE_SERIES.ORIGINAL_LZ.value);
                            }}
                            >
                                <div className={`width-116 height-116 border-radius-8 ${!zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                    <img src="/resources/images/machine/z_axis_extension.png" draggable={false} alt="" className="width-percent-100" />
                                </div>
                                <div className="align-c">{i18n._('key-settings/Z-axis Extension')}</div>
                            </Anchor>
                        </div>
                    </div>
                )}
                <div>
                    <div className={`heading-3 ${(includes([MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value], currentSerial)) ? 'margin-top-32' : ''} margin-bottom-16`}>
                        {i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}
                    </div>
                    <div className="sm-flex">
                        {toolHeadMap[currentSerial][headType].map((toolHeadItem, index) => {
                            return (
                                <Anchor
                                    onClick={() => {
                                        switchToolHead(toolHeadItem);
                                    }}
                                    className={`${index === 0 ? 'margin-right-16' : ''}`}
                                >
                                    <div className={`width-116 height-116 border-radius-8 border-default-grey-1 ${currentToolHead === toolHeadItem.value ? 'border-color-blue-2' : ''}`}>
                                        <img src={toolHeadItem.image} draggable={false} alt="" className="width-percent-100" />
                                    </div>
                                    <div className="align-c">{i18n._(`${toolHeadItem.label}`)}</div>
                                </Anchor>
                            );
                        })}
                    </div>
                </div>
                {headType === HEAD_PRINTING && (
                    <div className="margin-top-32">
                        <div>{i18n._('key-settings/Nozzle Diameter')} mm</div>
                        {currentToolHead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                            <div className="margin-top-16 width-248 height-32 background-grey-2 padding-2 border-radius-8">
                                <Anchor className={`padding-left-8 border-radius-8 width-122 display-inline ${activeNozzle === LEFT ? 'background-color-white' : ''}`} onClick={() => setActiveNozzle(LEFT)}>
                                    <span className="margin-right-8">{i18n._('key-Cnc/StlSection/orientation_Left-Left')}</span>
                                    <span>{leftNozzleDiameter}</span>
                                </Anchor>
                                <Anchor className={`padding-left-8 border-radius-8 width-122 display-inline ${activeNozzle === RIGHT ? 'background-color-white' : ''}`} onClick={() => setActiveNozzle(RIGHT)}>
                                    <span className="margin-right-8">{i18n._('key-Cnc/StlSection/orientation_Right-Right')}</span>
                                    <span>{rightNozzleDiameter}</span>
                                </Anchor>
                            </div>
                        )}
                        {activeNozzle === LEFT && (
                            <div className="sm-flex sm-flex-wrap margin-top-16">
                                {leftNozzleDiameterList.map((nozzle, index) => {
                                    return (
                                        <Anchor onClick={() => onChangeDiameter(LEFT, nozzle)} className={classNames(styles['diameter-item-wrapper'], `margin-bottom-8 width-56 padding-horizontal-8 height-32 border-radius-8 border-default-grey-1 ${(index === 3 || index === 7) ? '' : 'margin-right-8'} ${`${leftNozzleDiameter}` === nozzle.label ? 'border-color-blue-2' : ''}`)}>
                                            <div className={classNames(styles['diameter-item'], 'sm-flex justify-space-between')}>
                                                <span>{nozzle.label}</span>
                                                {!nozzle.isDefault && `${leftNozzleDiameter}` !== nozzle.label && (
                                                    <Anchor onClick={(e) => handleRemoveDiameter(e, nozzle.label, LEFT)} className={styles['close-icon']}>
                                                        <SvgIcon name="Cancel" size={8} type={['static']} />
                                                    </Anchor>
                                                )}
                                            </div>
                                        </Anchor>
                                    );
                                })}
                                {leftNozzleDiameterList.length < 8 && (
                                    <Anchor className={(classNames(addDiameterStatus ? 'border-blue-2' : 'padding-left-8 border-dashed-grey-1', 'width-56 height-32 border-radius-8', styles['add-nozzle-diameter-input']))} onClick={() => handleAddDiameter(true)}>
                                        {addDiameterStatus ? (
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
                                        )}
                                    </Anchor>
                                )}
                            </div>
                        )}
                        {activeNozzle === RIGHT && (
                            <div className="sm-flex sm-flex-wrap margin-top-16">
                                {rightNozzleDiameterList.map((nozzle, index) => {
                                    return (
                                        <Anchor onClick={() => onChangeDiameter(RIGHT, nozzle)} className={`margin-bottom-8  width-56 padding-horizontal-8 height-32 border-radius-8 border-default-grey-1 ${(index === 3 || index === 7) ? '' : 'margin-right-8'} ${`${rightNozzleDiameter}` === nozzle.label ? 'border-color-blue-2' : ''}`}>
                                            <div className="sm-flex justify-space-between ">
                                                <span>{nozzle.label}</span>
                                                {!nozzle.isDefault && `${rightNozzleDiameter}` !== nozzle.label && (
                                                    <Anchor onClick={(e) => handleRemoveDiameter(e, nozzle.label, RIGHT)}>
                                                        <SvgIcon name="Cancel" size={8} type={['static']} />
                                                    </Anchor>
                                                )}
                                            </div>
                                        </Anchor>
                                    );
                                })}
                                {rightNozzleDiameterList.length < 8 && (
                                    <Anchor className={(classNames(addDiameterStatus ? '' : 'padding-left-8', 'width-56 height-32 border-radius-8 border-dashed-grey-1'))} onClick={() => handleAddDiameter(true)}>
                                        {addDiameterStatus ? (
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
                                                +{i18n._('key-Settings/Nozazle-Add')}
                                            </span>
                                        )}
                                    </Anchor>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

MachineSettings.propTypes = {
    serial: PropTypes.string,
    toolHead: PropTypes.object,
    connectSerial: PropTypes.string,
    connectMachineName: PropTypes.string,
    // nozzleDiameter: PropTypes.number,
    // hasZAxis: PropTypes.bool,
    isConnected: PropTypes.bool,
    leftNozzleDiameter: PropTypes.number,
    rightNozzleDiameter: PropTypes.number,
    setSeries: PropTypes.func,
    setToolhead: PropTypes.func
};
export default MachineSettings;
