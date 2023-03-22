import isElectron from 'is-electron';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';

import type { Machine, ToolHead } from '@snapmaker/luban-platform';

import { CONNECTION_TYPE_SERIAL } from '../../../../constants';
import { findMachineByName, MACHINE_TOOL_HEADS } from '../../../../constants/machines';
import { RootState } from '../../../../flux/index.def';
import usePrevious from '../../../../lib/hooks/previous';
import i18n from '../../../../lib/i18n';
import UniApi from '../../../../lib/uni-api';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';

const MismatchModal: React.FC = () => {
    const {
        connectionType,
        isConnected,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);
    const prevIsConnected = usePrevious(isConnected);

    const machineSeries = useSelector((state: RootState) => state.machine.series);
    const machineToolHead = useSelector((state: RootState) => state.machine.toolHead);

    const connectedMachineIdentifier = useSelector((state: RootState) => state.workspace.machineIdentifier);
    const connectedToolHeadIdentifier = useSelector((state: RootState) => state.workspace.toolHead);
    const connectedMachineHeadType = useSelector((state: RootState) => state.workspace.headType);

    // calculated
    const [showMismatchModal, setShowMismatchModal] = useState(false);

    const onShowMachineSettings = useCallback(() => {
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
    }, []);

    useEffect(() => {
        if (!prevIsConnected && isConnected) {
            if (connectionType === CONNECTION_TYPE_SERIAL) {
                return;
            }

            const toolHeadKey = `${connectedMachineHeadType}Toolhead`;
            const machineToolHeadIdentifier = machineToolHead[toolHeadKey];

            if (connectedMachineIdentifier !== machineSeries) {
                setShowMismatchModal(true);
            } else if (connectedToolHeadIdentifier && machineToolHeadIdentifier !== connectedToolHeadIdentifier) {
                setShowMismatchModal(true);
            }
        }
    }, [
        connectionType,
        isConnected,
        prevIsConnected,

        machineSeries,
        machineToolHead,

        connectedToolHeadIdentifier,
        connectedMachineHeadType,
        connectedMachineIdentifier,
    ]);

    const machine = findMachineByName(machineSeries);
    const toolHeadInfo = MACHINE_TOOL_HEADS[machineToolHead[`${connectedMachineHeadType}Toolhead`]];

    const connectedMachine: Machine | null = findMachineByName(connectedMachineIdentifier);
    const connectedToolHead: ToolHead | null = MACHINE_TOOL_HEADS[connectedToolHeadIdentifier];

    return (
        <>
            {showMismatchModal && (
                <Modal
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
                            {
                                i18n._(
                                    'key-Workspace/Mismatch-The configured Machine Model ({{- machineInfo}}) does not match with the connected machine ({{- connectedMachineInfo}}). To change the settings, you can go to',
                                    {
                                        machineInfo: `${machine?.fullName} ${i18n._(toolHeadInfo?.label)}`,
                                        connectedMachineInfo: `${connectedMachine?.fullName || i18n._('key-Workspace/Connection-Unknown')} ${i18n._(connectedToolHead?.label) || ''}`,
                                    }
                                )
                            }
                            <span className="margin-right-4" />
                            <Anchor
                                onClick={onShowMachineSettings}
                                style={{
                                    fontWeight: 'bold'
                                }}
                            >
                                {i18n._('key-Workspace/Mismatch-Machine Settings')}
                            </Anchor>
                            <span>.</span>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            type="primary"
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
};

export default MismatchModal;
