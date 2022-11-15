import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import MaterialSettings from './materialSettings';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
import { LEVEL_ONE_POWER_LASER_FOR_ORIGINAL, SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL } from '../../../constants';
import { MACHINE_SERIES } from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine/index';
import { STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL } from '../../../../server/controllers/constants';
import MachineSettings from './MachineSettings';

const MACHINE_TAB = 'machine';
const MATERIAL_TAB = 'material';
const MachineMaterialSettings = ({ isPopup, onClose, onCallBack }) => {
    const machineState = useSelector(state => state?.machine);
    const workspaceState = useSelector(state => state?.workspace);

    const { series, toolHead, isConnected, server } = machineState;
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
    const [currentSeries, setCurrentSeries] = useState(series);
    const [currentToolhead, setCurrentToolhead] = useState(toolHead);
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const originToolhead = {
            cncToolhead: STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
            laserToolhead: LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
            printingToolhead: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL
        };
        const sm2Toolhead = currentToolhead;
        const tempToolhead = (currentSeries === MACHINE_SERIES.ORIGINAL.value || currentSeries === MACHINE_SERIES.ORIGINAL_LZ.value) ? originToolhead : sm2Toolhead;
        setCurrentToolhead(tempToolhead);
        setLoading(true);
        onCallBack(currentSeries, tempToolhead);

        (async () => {
            await dispatch(machineActions.onChangeMachineSeries(tempToolhead, currentSeries));
            setLoading(false);
        })();
    }, [currentSeries, currentToolhead.printingToolhead]);

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
                <Anchor onClick={() => onCloseHandle()} className="sm-flex justify-flex-end">
                    <SvgIcon
                        size={24}
                        name="Cancel"
                        type={['static']}
                    />
                </Anchor>
            )}
            <div className="background-color-white margin-top-16 border-radius-24 height-all-minus-98">
                <div className="height-56 padding-left-80 border-bottom-normal sm-flex">

                    <Anchor onClick={() => setSelectTabHandle(MACHINE_TAB)} className={`${selectTab === MACHINE_TAB ? 'border-bottom-black-3' : ''}  margin-right-64`}>
                        <div className={`${selectTab === MACHINE_TAB ? 'heading-2' : 'heading-2-unselect'}`}>
                            {i18n._('key-Settings/Select Machine')}
                        </div>
                    </Anchor>
                    <Anchor onClick={() => setSelectTabHandle(MATERIAL_TAB)} className={`${selectTab === MATERIAL_TAB ? 'border-bottom-black-3' : ''}`}>
                        <div className={`${selectTab === MATERIAL_TAB ? 'heading-2' : 'heading-2-unselect'}`}>
                            {i18n._('key-Settings/Select Material')}
                        </div>
                    </Anchor>
                </div>
                {selectTab === MACHINE_TAB && (
                    <MachineSettings
                        ref={ref}
                        isConnected={isConnected}
                        series={currentSeries}
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
