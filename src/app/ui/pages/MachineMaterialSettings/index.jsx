import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import MachineSettings from './machineSettings';
import MaterialSettings from './materialSettings';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
import { MACHINE_SERIES, SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL } from '../../../constants';
import { actions as machineActions } from '../../../flux/machine/index';

const MACHINE_TAB = 'machine';
const MATERIAL_TAB = 'material';
const MachineMaterialSettings = ({ isPopup, onClose, onCallBack }) => {
    const machineState = useSelector(state => state?.machine);
    const workspaceState = useSelector(state => state?.workspace);
    const { series: serial, toolHead, isConnected, server } = machineState;
    const { series: connectSerial } = workspaceState;
    const [selectTab, setSelectTab] = useState(MATERIAL_TAB);
    const leftDiameter = useSelector(
        (state) => state?.printing?.extruderLDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );
    const rightDiameter = useSelector(
        (state) => state?.printing?.extruderRDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );
    const [currentSeries, setCurrentSeries] = useState(serial);
    const [currentToolhead, setCurrentToolhead] = useState(toolHead);
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const tempToolhead = currentSeries === MACHINE_SERIES.ORIGINAL.value ? { ...currentToolhead, printingToolhead: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL } : { ...currentToolhead };
        setCurrentToolhead(tempToolhead);
        setLoading(true);
        onCallBack(currentSeries, tempToolhead);
        (async () => {
            await dispatch(machineActions.onChangeMachineSeries(tempToolhead, currentSeries));
            setLoading(false);
        })();
    }, [currentSeries]);

    useEffect(() => {
        setLoading(true);
        onCallBack(currentSeries, currentToolhead);
        (async () => {
            await dispatch(machineActions.onChangeMachineSeries(currentToolhead, currentSeries));
            setLoading(false);
        })();
    }, [currentToolhead.printingToolhead]);


    const ref = useRef(null);
    // Before switching models, make sure that the nozzle diameter exists
    const onCloseHandle = () => {
        ref.current?.checkNozzleDiameter();
        onClose();
    };

    const setSelectTabHandle = (tabName) => {
        ref.current?.checkNozzleDiameter();
        setSelectTab(tabName);
    };

    return (
        <div className="padding-top-16 padding-horizontal-40 height-100vh">
            {isPopup && (
                <Tooltip title={i18n._('key-Workspace/Page-Back')}>
                    <Anchor onClick={() => onCloseHandle()}>
                        <SvgIcon
                            size={24}
                            name="MainToolbarBack"
                            type={['static']}
                        />
                        <span>{i18n._('key-Workspace/Page-Back')}</span>
                    </Anchor>
                </Tooltip>
            )}
            <div className="background-color-white margin-top-16 border-radius-24 height-all-minus-98">
                <div className="height-56 padding-left-80 border-bottom-normal sm-flex">

                    <Anchor onClick={() => setSelectTabHandle(MACHINE_TAB)} className={`${selectTab === MACHINE_TAB ? 'border-bottom-black-3' : ''}  margin-right-64`}>
                        <div className="heading-2">
                            {i18n._('key-Settings/Select Machine')}
                        </div>
                    </Anchor>
                    <Anchor onClick={() => setSelectTabHandle(MATERIAL_TAB)} className={`${selectTab === MATERIAL_TAB ? 'border-bottom-black-3' : ''}`}>
                        <div className="heading-2">
                            {i18n._('key-Settings/Select Material')}
                        </div>
                    </Anchor>
                </div>
                {selectTab === MACHINE_TAB && (
                    <MachineSettings
                        ref={ref}
                        isConnected={isConnected}
                        serial={currentSeries}
                        toolHead={currentToolhead}
                        connectSerial={connectSerial}
                        connectMachineName={server?.name}
                        leftNozzleDiameter={leftDiameter}
                        rightNozzleDiameter={rightDiameter}
                        setSeries={setCurrentSeries}
                        setToolhead={setCurrentToolhead}
                    />
                )}
                {selectTab === MATERIAL_TAB && (
                    <MaterialSettings
                        toolHead={currentToolhead}
                        series={currentSeries}
                        loading={loading}
                    />
                )}
            </div>
        </div>
    );
};

MachineMaterialSettings.propTypes = {
    isPopup: PropTypes.bool,
    onClose: PropTypes.func,
    onCallBack: PropTypes.func
};

export default MachineMaterialSettings;
