import { WorkflowStatus } from '@snapmaker/luban-platform';
import { Spin } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';

import { RootState } from '../../../../flux/index.def';
import { WORKSPACE_STAGE, actions as workspaceActions } from '../../../../flux/workspace';
import { ConnectionType } from '../../../../flux/workspace/state';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Dropdown from '../../../components/Dropdown';
import Menu from '../../../components/Menu';
import Modal from '../../../components/Modal';
import Canvas from '../../../components/SMCanvas';
import SvgIcon from '../../../components/SvgIcon';
import SecondaryToolbar from '../../CanvasToolbar/SecondaryToolbar';
import PrintablePlate from '../../WorkspaceVisualizer/PrintablePlate';
import GCodeParams from '../GCodeParams';

export const visualizerGroup = {
    object: new THREE.Group()
};

interface PreviewModalProps {
    gcodeFile: object | null;
    onStartToSendFile: () => void;
    onStartToPrint: () => void;
    canSend: boolean;
    canStartPrint: boolean;
}

const PreviewModal: React.FC<PreviewModalProps> = (props) => {
    const dispatch = useDispatch();

    const {
        gcodeFile,
        onStartToSendFile,
        onStartToPrint,
        canSend,
        canStartPrint,
    } = props;

    const {
        connectionType,
        isConnected,
    } = useSelector((state: RootState) => state.workspace);

    const {
        workflowStatus,

        previewModelGroup,
        previewRenderState,
    } = useSelector((state: RootState) => state.workspace);

    const { size } = useSelector((state: RootState) => state.machine);

    const closeModal = useCallback(() => {
        dispatch(workspaceActions.updateState({
            previewStage: WORKSPACE_STAGE.EMPTY
        }));
    }, [dispatch]);


    const canvas = useRef<Canvas>();
    const printableArea = useMemo(() => {
        return new PrintablePlate({
            x: size.x * 2,
            y: size.y * 2
        });
    }, [size]);

    return (
        <Modal
            centered
            open
            onClose={closeModal}
        >
            <Modal.Header>
                {i18n._('key-Workspace/Transport-Preview')}
            </Modal.Header>
            <Modal.Body>
                <div style={{ width: 944, height: 522 }} className="position-re">
                    {previewRenderState === 'rendered' && (
                        <Canvas
                            ref={canvas}
                            size={size}
                            modelGroup={visualizerGroup}
                            printableArea={printableArea}
                            cameraInitialPosition={new THREE.Vector3(0, 0, Math.min(size.z * 2, 300))}
                            cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        />
                        // <Spin />
                    )}
                    {previewRenderState === 'rendered' && (
                        <div className={classNames('position-absolute', 'left-8', 'bottom-8')}>
                            <SecondaryToolbar
                                zoomIn={() => canvas.current.zoomIn()}
                                zoomOut={() => canvas.current.zoomOut()}
                                toFront={() => canvas.current.autoFocus(previewModelGroup.children[0], true)}
                            />
                        </div>
                    )}
                    {previewRenderState !== 'rendered' && (
                        <div className="position-absolute position-absolute-center">
                            <Spin />
                        </div>
                    )}
                    <GCodeParams gcodeFile={gcodeFile} />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    priority="level-two"
                    type="default"
                    className="margin-right-8"
                    width="88px"
                    onClick={closeModal}
                >
                    {i18n._('key-unused-Cancel')}
                </Button>
                {
                    connectionType === ConnectionType.WiFi && isConnected && workflowStatus !== WorkflowStatus.Idle && (
                        <Button
                            priority="level-two"
                            type="primary"
                            width="200px"
                            onClick={onStartToSendFile}
                        >
                            {i18n._('key-Workspace/WifiTransport-Sending File')}
                        </Button>
                    )
                }
                {
                    connectionType === ConnectionType.WiFi && isConnected && workflowStatus === WorkflowStatus.Idle && (
                        <Dropdown
                            className="display-inline"
                            overlay={() => (
                                <Menu>
                                    {
                                        canSend && (
                                            <Menu.Item
                                                onClick={() => {
                                                    onStartToSendFile();
                                                    closeModal();
                                                }}
                                            >
                                                <div className="align-c">{i18n._('key-Workspace/WifiTransport-Sending File')}</div>
                                            </Menu.Item>
                                        )
                                    }
                                    {
                                        canStartPrint && (
                                            <Menu.Item onClick={() => {
                                                onStartToPrint();
                                                closeModal();
                                            }}
                                            >
                                                <div className="align-c">{i18n._('Start on Luban')}</div>
                                            </Menu.Item>
                                        )
                                    }
                                </Menu>
                            )}
                            trigger="click"
                        >
                            <Button
                                suffixIcon={<SvgIcon name="DropdownOpen" type={['static']} color="#d5d6d9" />}
                                priority="level-two"
                                type="primary"
                                width="200px"
                            >
                                {i18n._('key-Workspace/LaserStartJob-start_job')}
                            </Button>
                        </Dropdown>
                    )
                }
                {
                    connectionType === ConnectionType.Serial && isConnected && workflowStatus === WorkflowStatus.Idle && (
                        <Button
                            priority="level-two"
                            type="primary"
                            width="200px"
                            onClick={() => {
                                onStartToPrint();
                                closeModal();
                            }}
                        >
                            <div className="align-c">{i18n._('Start on Luban')}</div>
                        </Button>
                    )
                }
            </Modal.Footer>
        </Modal>
    );
};

export default PreviewModal;
