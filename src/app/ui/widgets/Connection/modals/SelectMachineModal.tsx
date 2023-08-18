import type { Machine, ToolHead } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    getMachineOptions,
    getMachineSupportedToolOptions
} from '../../../../constants/machines';
import { RootState } from '../../../../flux/index.def';
import { actions as workspaceActions } from '../../../../flux/workspace';
import { ConnectionType } from '../../../../flux/workspace/state';
import usePrevious from '../../../../lib/hooks/previous';
import i18n from '../../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import styles from './styles.styl';


/**
 * Modal for selecting machine in use.
 *
 * When connecting to machine via serial port, we don't detect machine
 * automatically. Users are prompt to manually select the machine in use.
 */
const SelectMachineModal: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const onClose = useCallback(() => {
        setShowModal(false);
    }, []);

    // connection
    const {
        connectionType,
        isConnected,
    } = useSelector((state: RootState) => state.workspace);
    const prevIsConnected = usePrevious(isConnected);

    const activeMachine: Machine | null = useSelector((state: RootState) => state.workspace.activeMachine);
    const activeTool: ToolHead | null = useSelector((state: RootState) => state.workspace.activeTool);

    useEffect(() => {
        if (!prevIsConnected && isConnected) {
            if (connectionType === ConnectionType.WiFi) {
                return;
            }

            if (activeMachine && activeTool) {
                return;
            }

            setShowModal(true);
        }
    }, [
        connectionType,
        isConnected,
        prevIsConnected,
        activeMachine,
        activeTool,
    ]);

    // machine
    const {
        series: machineIdentifier,
    } = useSelector((state: RootState) => state.machine);

    // temporary selection of machine and toolhead
    const [selectedMachineIdentifier, setSelectedMachineIdentifier] = useState(machineIdentifier);

    useEffect(() => {
        if (activeMachine) {
            setSelectedMachineIdentifier(activeMachine.identifier);
        }
    }, [activeMachine]);

    const onChangeMachine = useCallback((identifier: string) => {
        setSelectedMachineIdentifier(identifier);
    }, []);

    const machineOptions = useMemo(() => getMachineOptions(), []);

    // tool
    const [selectedToolHead, setSelectedToolHead] = useState<ToolHead | null>(activeTool);

    useEffect(() => {
        if (activeTool) {
            setSelectedToolHead(activeTool);
        }
    }, [activeTool]);

    const onChangeToolHead = useCallback((tool: ToolHead) => {
        setSelectedToolHead(tool);
    }, []);

    const toolHeadOptions = useMemo(() => {
        return getMachineSupportedToolOptions(selectedMachineIdentifier);
    }, [selectedMachineIdentifier]);

    /**
     * Click confirm to apply selections.
     */
    const dispatch = useDispatch();
    const onClickConfirm = useCallback(() => {
        // onSelect should close the modal
        setShowModal(false);

        dispatch(workspaceActions.updateMachineState({
            machineIdentifier: selectedMachineIdentifier,
            toolHead: selectedToolHead.identifier,
            headType: selectedToolHead.metadata.headType,
        }));

        // TODO: For SM 2.0 with laser/CNC tool head, execute G54 right after selection
    }, [dispatch, selectedMachineIdentifier, selectedToolHead]);



    if (!showModal) {
        // Empty
        return (<></>);
    }

    return (
        <Modal closable={false} size="md" onClose={onClose}>
            <Modal.Header>
                {/* <Modal.Title> */}
                {i18n._('key-Workspace/MachineSelectModal-Device Not Recognized')}
                {/* </Modal.Title> */}
            </Modal.Header>
            <Modal.Body>
                <div className="margin-bottom-8">{i18n._('key-Workspace/MachineSelectModal-Select the machine model that is connected to Luban')}
                </div>
                <div className={styles['select-tools']}>
                    {
                        machineOptions.map(item => {
                            const machine = item.machine;

                            return (
                                <div key={item.value} className={styles['select-tool']}>
                                    <Anchor
                                        className={classNames(
                                            styles['select-tool-btn'],
                                            {
                                                [styles.selected]: item.value === selectedMachineIdentifier,
                                            }
                                        )}
                                        onClick={() => onChangeMachine(item.value)}
                                    >
                                        <img src={machine.img} role="presentation" alt="Machine" />
                                    </Anchor>
                                    <span className={styles['select-tool-text']}>{i18n._(item.label)}</span>
                                </div>
                            );
                        })
                    }
                </div>
                <div>
                    <div className={classNames(styles.separator, styles['separator-underline'])} />
                    <div className="margin-bottom-8">{i18n._('key-Workspace/MachineSelectModal-Which toolhead is attached to your Snapmaker Luban?')}</div>
                    <div className={styles['select-tools']}>
                        {
                            toolHeadOptions.map(item => {
                                return (
                                    <div key={item.value} className={styles['select-tool']}>
                                        <Anchor
                                            className={classNames(
                                                styles['select-tool-btn'],
                                                {
                                                    [styles.selected]: item.value === selectedToolHead?.identifier,
                                                }
                                            )}
                                            onClick={() => onChangeToolHead(item.tool)}
                                        >
                                            <img
                                                src={item.tool.image}
                                                alt="Tool"
                                            />
                                        </Anchor>
                                        <span className={styles['select-tool-text']}>{i18n._(item.label)}</span>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    priority="level-two"
                    width="96px"
                    onClick={onClickConfirm}
                >
                    {i18n._('key-Workspace/MachineSelectModal-Select')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SelectMachineModal;
