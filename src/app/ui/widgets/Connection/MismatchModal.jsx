import isElectron from 'is-electron';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { findMachineByName, MACHINE_TOOL_HEADS, } from '../../../constants/machines';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';

function MismatchModal() {
    const toolHead = useSelector(state => state?.workspace.toolHead);
    const headType = useSelector(state => state?.workspace.headType);
    const series = useSelector(state => state?.workspace.series);
    const isConnected = useSelector(state => state?.machine?.isConnected);
    const machineSeries = useSelector(state => state?.machine?.series);
    const machineToolHead = useSelector(state => state?.machine?.toolHead);
    const [showMismatchModal, setShowMismatchModal] = useState(false);
    const prevIsConnected = usePrevious(isConnected);

    function onShowMachinwSettings() {
        const { BrowserWindow } = window.require('@electron/remote');
        const browserWindow = BrowserWindow.getFocusedWindow();
        if (isElectron()) {
            browserWindow.webContents.send('preferences.show', {
                activeTab: 'machine'
            });
        } else {
            UniApi.Event.emit('appbar-menu:preferences.show', {
                activeTab: 'machine'
            });
        }
    }

    useEffect(() => {
        if (!prevIsConnected && isConnected) {
            if (series && series !== machineSeries) {
                setShowMismatchModal(true);
            } else if (toolHead && machineToolHead[`${headType}Toolhead`] !== toolHead) {
                setShowMismatchModal(true);
            }
        }
    }, [prevIsConnected, isConnected, toolHead, headType, series, machineSeries, machineToolHead]);

    const machine = machineSeries && findMachineByName(machineSeries) || {};
    const toolHeadInfo = MACHINE_TOOL_HEADS[machineToolHead[`${headType}Toolhead`]];

    const connectedMachine = series && findMachineByName(series) || {};

    return (
        <>
            {showMismatchModal && (
                <Modal
                    showCloseButton
                    onClose={() => {
                        setShowMismatchModal(false);
                    }}
                    style={{
                        borderRadius: '8px'
                    }}
                >
                    <Modal.Header>
                        {i18n._('key-Workspace/Mismatch-Inconsistent_Machine_Model')}
                    </Modal.Header>
                    <Modal.Body style={{
                        maxWidth: '432px'
                    }}
                    >
                        <div>
                            {i18n._('key-Workspace/Mismatch-The configured Machine Model ({{machineInfo}}) does not match with the connected machine ({{connectedMachineInfo}}). To change the settings, you can go to',
                                {
                                    machineInfo: `${machine?.seriesLabelWithoutI18n} ${i18n._(toolHeadInfo?.label)}`,
                                    connectedMachineInfo: `${connectedMachine?.seriesLabelWithoutI18n} ${i18n._(MACHINE_TOOL_HEADS[toolHead]?.label)}`,
                                })}
                            <Anchor
                                onClick={onShowMachinwSettings}
                                style={{
                                    fontWeight: 'bold'
                                }}
                            >
                                {i18n._('key-Workspace/Mismatch-Machine Settings')}
                            </Anchor>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={() => {
                                setShowMismatchModal(false);
                            }}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </>
    );
}

export default MismatchModal;
