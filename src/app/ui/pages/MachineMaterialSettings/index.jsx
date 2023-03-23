import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import MaterialSettings from './materialSettings';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
import { getMachineSupportedTools, HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants/machines';
// import { actions as machineActions } from '../../../flux/machine/index';
import MachineSettings from './MachineSettings';


const MACHINE_TAB = 'machine';
const MATERIAL_TAB = 'material';
const MachineMaterialSettings = ({ isPopup, onClose, onCallBack }) => {
    const { series, toolHead } = useSelector(state => state.machine);
    const { isConnected, server } = useSelector(state => state.workspace);

    const { series: connectSerial } = useSelector(state => state.workspace);

    const [selectTab, setSelectTab] = useState(MATERIAL_TAB);

    const [selectedMachineSeries, setSelectedMachineSeries] = useState(series);
    const [selectedToolMap, setSelectedToolMap] = useState(toolHead);
    // const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);

    // series changed
    useEffect(() => {
        // Update tool head map upon machine series
        const newToolHead = {
            printingToolhead: '',
            laserToolhead: '',
            cncToolhead: '',
        };

        for (const headType of [HEAD_PRINTING, HEAD_LASER, HEAD_CNC]) {
            const tools = getMachineSupportedTools(selectedMachineSeries, headType);

            const toolName = selectedToolMap[`${headType}Toolhead`];
            let selectedTool = null;
            for (const tool of tools) {
                if (tool.identifier === toolName) {
                    selectedTool = tool;
                    break;
                }
            }

            if (!selectedTool && tools.length > 0) {
                selectedTool = tools[0];
            }

            if (selectedTool) {
                newToolHead[`${headType}Toolhead`] = selectedTool.identifier;
            }
        }

        setSelectedToolMap(newToolHead);

        /*
        // start set active machine & tool head
        setLoading(true);
        onCallBack(selectedMachineSeries, newToolHead);

        (async () => {
            await dispatch(machineActions.onChangeMachineSeries(newToolHead, selectedMachineSeries));
            setLoading(false);
        })();
        */
    }, [selectedMachineSeries]);

    // tool head changed
    useEffect(() => {
        // start set active machine & tool head
        setLoading(true);
        onCallBack(selectedMachineSeries, selectedToolMap);

        /*
        (async () => {
            await dispatch(machineActions.onChangeMachineSeries(selectedToolMap, selectedMachineSeries));
            setLoading(false);
        })();
        */
        setLoading(false);
    }, [selectedMachineSeries, selectedToolMap]);

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
            {
                isPopup && (
                    <Anchor onClick={() => onCloseHandle()} className="sm-flex justify-flex-end">
                        <SvgIcon
                            size={24}
                            name="Cancel"
                            type={['static']}
                        />
                    </Anchor>
                )
            }
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
                        series={selectedMachineSeries}
                        toolMap={selectedToolMap}
                        connectSerial={connectSerial}
                        connectMachineName={server?.name}
                        setSeries={setSelectedMachineSeries}
                        setToolhead={setSelectedToolMap}
                    />
                )}
                {selectTab === MATERIAL_TAB && (
                    <MaterialSettings
                        toolMap={selectedToolMap}
                        series={selectedMachineSeries}
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
