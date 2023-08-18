import type { MachineToolHeadOptions } from '@snapmaker/luban-platform';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { RootState } from '../../../../flux/index.def';
import { actions as workspaceActions } from '../../../../flux/workspace';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';

/**
 * Component that checks if machine is not homed.
 *
 * If yes, popup the modal to guide user to do home operation.
 *
 * TODO: Original Machine doesn't need home. why?
 */
const GoHomeModal: React.FC = () => {
    const dispatch = useDispatch();

    const {
        isConnected,
    } = useSelector((state: RootState) => state.workspace);

    const {
        isHomed,

        activeMachine,
    } = useSelector((state: RootState) => state.workspace);

    const activeMachineToolOptions: MachineToolHeadOptions | null = useSelector((state: RootState) => state.workspace.activeMachineToolOptions, shallowEqual);

    const [showModal, setShowModal] = useState(false);

    const [homing, setHoming] = useState(false);

    useEffect(() => {
        if (isConnected && activeMachine && activeMachineToolOptions) {
            // You must explicitly declare goHomeOnConnection: false to skip going home
            if (activeMachineToolOptions.goHomeOnConnection === false) {
                return;
            }

            if (!isHomed) {
                setShowModal(true);
            } else {
                // already homed, which means machine coordinates are ready
                setShowModal(false);

                setHoming(false);
            }
        }
    }, [isConnected, activeMachine, activeMachineToolOptions, isHomed]);

    const onClickGoHome = useCallback(() => {
        if (isConnected) {
            dispatch(workspaceActions.executeGcodeAutoHome());
            setHoming(true);
        }
    }, [dispatch, isConnected]);

    if (!showModal) {
        return null;
    }

    return (
        <Modal size="sm" closable={false}>
            <Modal.Header>
                {i18n._('key-Workspace/Connection-Go Home')}
            </Modal.Header>
            <Modal.Body>
                <div>
                    {i18n._('key-Workspace/Connection-To continue, the machine needs to return to the start position of the X, Y, and Z axes.')}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    loading={homing}
                    priority="level-two"
                    className="align-r"
                    width="96px"
                    onClick={onClickGoHome}
                >
                    {!homing && (
                        <span>{i18n._('key-Workspace/Connection-OK')}</span>
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default GoHomeModal;
