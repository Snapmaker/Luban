import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
// import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
// import { useDispatch } from 'react-redux';
import { find, includes, remove } from 'lodash';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, getCurrentHeadType, HEAD_CNC, HEAD_LASER, HEAD_PRINTING, LEVEL_ONE_POWER_LASER_FOR_ORIGINAL, LEVEL_ONE_POWER_LASER_FOR_SM2, LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2, LEVEL_TWO_POWER_LASER_FOR_SM2, MACHINE_SERIES, MACHINE_TOOL_HEADS, PRINTING_SINGLE_EXTRUDER_HEADTOOL, SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL, SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2, STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL, STANDARD_CNC_TOOLHEAD_FOR_SM2 } from '../../../constants';
import { LEFT, RIGHT } from '../../../../server/constants';
import SvgIcon from '../../components/SvgIcon';
import { NumberInput as Input } from '../../components/Input';
// import { actions as machineActions } from '../../../flux/machine';
// import { actions as machineActions } from '../../../flux/machine';

const machineList = [{
    value: 'Original',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Original',
    image: '/resources/images/machine/size-1.0-original.jpg'
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
    image: '/resources/images/machine/size-2.0-A350.jpg'
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
    value: '0.4H',
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
const MachineSettings = ({
    serial,
    toolHead,
    connectSerial,
    connectMachineName = 'test machine name',
    leftNozzleDiameter: defaultLeftDiameter,
    rightNozzleDiameter: defaultRightDiameter,
    hasZAxis, // for original long zAxis
    isConnected,
    setSeries,
    setToolhead
}) => {
    // const dispatch = useDispatch();
    const [headType, setHeadType] = useState(HEAD_PRINTING);
    const [currentSerial, setCurrentSerial] = useState(serial);
    const [currentToolHead, setCurrentToolHead] = useState(toolHead[`${headType}Toolhead`]);
    const [leftNozzleDiameter, setLeftNozzleDiameter] = useState(defaultLeftDiameter);
    const [rightNozzleDiameter, setRightNozzleDiameter] = useState(defaultRightDiameter);
    const [activeNozzle, setActiveNozzle] = useState(LEFT);
    // const dispatch = useDispatch();

    // for original long zAxis
    const [zAxis, setZAxis] = useState(hasZAxis);
    const [leftNozzleDiameterList, setLeftNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [rightNozzleDiameterList, setRightNozzleDiameterList] = useState(defaultNozzleDiameterList);
    const [addDiameterStatus, setAddDiameterStatus] = useState(false);
    const handleMachineUpdate = (value) => {
        setCurrentSerial(value);
        if (value === MACHINE_SERIES.ORIGINAL.value) {
            setCurrentToolHead(SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL);
        } else {
            setCurrentToolHead(SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2);
        }
    };
    const handleAddDiameter = (status) => {
        setAddDiameterStatus(status);
    };
    const handleRemoveDiameter = (value, direction) => {
        if (direction === LEFT) {
            const newLeftList = remove(leftNozzleDiameterList, (list) => {
                return list.value !== value;
            });
            setLeftNozzleDiameterList(newLeftList);
        } else {
            const newRightList = remove(rightNozzleDiameterList, (list) => {
                return list.value !== value;
            });
            setRightNozzleDiameterList(newRightList);
        }
    };
    const AddDiameterToList = (e, direction) => {
        const newValue = e.target.value;
        if (!newValue) {
            setAddDiameterStatus(false);
            return;
        }
        if (direction === LEFT) {
            if (!find(leftNozzleDiameterList, { value: Number(newValue) })) {
                setLeftNozzleDiameterList([...leftNozzleDiameterList, {
                    label: newValue,
                    value: Number(newValue),
                    isDefault: false
                }]);
            }
        } else {
            if (!find(rightNozzleDiameterList, { value: Number(newValue) })) {
                setRightNozzleDiameterList([...rightNozzleDiameterList, {
                    label: newValue,
                    value: Number(newValue),
                    isDefault: false
                }]);
            }
        }
        setAddDiameterStatus(false);
    };
    const resizeAction = () => {
        const ele = document.getElementById('machine-list');
        if (window.innerWidth < 1360) {
            ele.className = 'overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 grid-template-columns-for-machine-settings grid-template-row-for-machine-settings-small-screen width-all-minus-328';
        } else {
            ele.className = 'overflow-y-auto sm-grid grid-column-gap-32 grid-row-column-60 grid-template-columns-for-machine-settings grid-template-row-for-machine-settings width-all-minus-328';
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

    useEffect(() => {
        setSeries(currentSerial);
        setToolhead({
            ...toolHead,
            [`${headType}Toolhead`]: currentToolHead
        });
        if (currentToolHead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            switch (currentSerial) {
                case MACHINE_SERIES.A400.value:
                    setLeftNozzleDiameterList(defaultNozzleDiameterListForDualExtruderArtisan);
                    setRightNozzleDiameterList(defaultNozzleDiameterListForDualExtruderArtisan);
                    break;
                default:
                    setLeftNozzleDiameterList(defaultNozzleDiameterListForDualExtruder);
                    setRightNozzleDiameterList(defaultNozzleDiameterListForDualExtruder);
                    break;
            }
        } else if (includes(PRINTING_SINGLE_EXTRUDER_HEADTOOL, currentToolHead)) {
            setLeftNozzleDiameterList(defaultNozzleDiameterListForSingleExtruder);
            setRightNozzleDiameterList([]);
        }
    }, [currentSerial, currentToolHead]);

    return (
        <div className="sm-flex padding-vertical-40 padding-horizontal-40 justify-space-between height-all-minus-60">
            {console.log({ currentSerial, isConnected, serial, toolHead, connectSerial, connectMachineName, headType, leftNozzleDiameterList, setLeftNozzleDiameterList, rightNozzleDiameterList, setRightNozzleDiameterList })}
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
                                    <img src={item.image} alt="" className={`width-percent-100 ${currentSerial === item.value ? 'border-radius-16 border-blod-blue-2' : ''}`} style={{ height: 'calc(100% - 22px)' }} />
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
                {currentSerial === MACHINE_SERIES.ORIGINAL.value && (
                    <div>
                        <div className="heading-3 margin-bottom-16">{i18n._('key-settings/Z-axis Module')}</div>
                        <div className="sm-flex justify-space-between">
                            <Anchor onClick={() => setZAxis(false)}>
                                <div className={`width-116 height-116 border-radius-8 ${zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                    <img src="/resources/images/machine/z_axis_standard.png" alt="" className="width-percent-100" />
                                </div>
                                <div className="align-c">{i18n._('Standard')}</div>
                            </Anchor>
                            <Anchor onClick={() => setZAxis(true)}>
                                <div className={`width-116 height-116 border-radius-8 ${!zAxis ? 'border-default-grey-1' : 'border-default-grey-1 border-color-blue-2'}`}>
                                    <img src="/resources/images/machine/z_axis_extension.png" alt="" className="width-percent-100" />
                                </div>
                                <div className="align-c">{i18n._('Extension')}</div>
                            </Anchor>
                        </div>
                    </div>
                )}
                <div>
                    <div className={`heading-3 ${currentSerial === MACHINE_SERIES.ORIGINAL.value ? 'margin-top-32' : ''} margin-bottom-16`}>
                        {i18n._('key-unused-Toolhead')}
                    </div>
                    <div className="sm-flex">
                        {toolHeadMap[currentSerial][headType].map((toolHeadItem, index) => {
                            return (
                                <Anchor onClick={() => setCurrentToolHead(toolHeadItem.value)} className={`${index === 0 ? 'margin-right-16' : ''}`}>
                                    <div className={`width-116 height-116 border-radius-8 border-default-grey-1 ${currentToolHead === toolHeadItem.value ? 'border-color-blue-2' : ''}`}>
                                        <img src={toolHeadItem.image} alt="" className="width-percent-100" />
                                    </div>
                                    <div>{i18n._(`${toolHeadItem.label}`)}</div>
                                </Anchor>
                            );
                        })}
                    </div>
                </div>
                {headType === HEAD_PRINTING && (
                    <div className="margin-top-32">
                        <div>{i18n._('key-settings/Nozzle Extruder')}</div>
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
                                        <Anchor onClick={() => setLeftNozzleDiameter(nozzle.value)} className={`margin-bottom-8 width-56 padding-horizontal-8 height-32 border-radius-8 border-default-grey-1 ${(index === 3 || index === 7) ? '' : 'margin-right-8'} ${leftNozzleDiameter === nozzle.value ? 'border-color-blue-2' : ''}`}>
                                            <div className="sm-flex justify-space-between ">
                                                <span>{nozzle.label}</span>
                                                {!nozzle.isDefault && (
                                                    <SvgIcon
                                                        name="Cancel"
                                                        size={8}
                                                        type={['static']}
                                                        onClick={() => handleRemoveDiameter(nozzle.value, LEFT)}
                                                    />
                                                )}
                                            </div>
                                        </Anchor>
                                    );
                                })}
                                {leftNozzleDiameterList.length < 8 && (
                                    <Anchor className={(classNames(addDiameterStatus ? '' : 'padding-left-8', 'width-56 height-32 border-radius-8 border-dashed-grey-1'))} onClick={() => handleAddDiameter(true)}>
                                        {addDiameterStatus ? (
                                            <Input
                                                min={0.1}
                                                max={1.2}
                                                bordered={false}
                                                size="super-small"
                                                autoFocus
                                                placeholder="Add"
                                                onPressEnter={e => AddDiameterToList(e, LEFT)}
                                                onBlur={e => AddDiameterToList(e, LEFT)}
                                            />
                                        ) : (
                                            <span>
                                                +Add
                                            </span>
                                        )}
                                    </Anchor>
                                )}
                            </div>
                        )}
                        {activeNozzle === RIGHT && (
                            <div className="sm-flex sm-flex-wrap margin-top-16">
                                {rightNozzleDiameterList.map(nozzle => {
                                    return (
                                        <Anchor onClick={() => setRightNozzleDiameter(nozzle.value)} className={`margin-bottom-8 padding-left-8 width-56 height-32 border-radius-8 border-default-grey-1 ${rightNozzleDiameter === nozzle.value ? 'border-color-blue-2' : ''}`}>
                                            <div>
                                                <span>{nozzle.label}</span>
                                                {!nozzle.isDefault && (
                                                    <SvgIcon
                                                        name="Cancel"
                                                        size={8}
                                                        type={['static']}
                                                        onClick={() => handleRemoveDiameter(nozzle.value, LEFT)}
                                                    />
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
                                                bordered={false}
                                                size="super-small"
                                                autoFocus
                                                placeholder="Add"
                                                onPressEnter={e => AddDiameterToList(e, RIGHT)}
                                                onBlur={e => AddDiameterToList(e, RIGHT)}
                                            />
                                        ) : (
                                            <span>
                                                +Add
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
};

MachineSettings.propTypes = {
    serial: PropTypes.string,
    toolHead: PropTypes.object,
    connectSerial: PropTypes.string,
    connectMachineName: PropTypes.string,
    // nozzleDiameter: PropTypes.number,
    hasZAxis: PropTypes.bool,
    isConnected: PropTypes.bool,
    leftNozzleDiameter: PropTypes.number,
    rightNozzleDiameter: PropTypes.number,
    setSeries: PropTypes.func,
    setToolhead: PropTypes.func
};
export default MachineSettings;
