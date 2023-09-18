import { MachineToolHeadOptions, WorkflowStatus } from '@snapmaker/luban-platform';
import { Spin } from 'antd';
import classNames from 'classnames';
import _, { includes } from 'lodash';
// import { Trans } from 'react-i18next';
import path from 'path';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';

import SocketEvent from '../../../communication/socket-events';
import {
    AUTO_MDOE,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    MANUAL_MODE,
    SEMI_AUTO_MODE
} from '../../../constants';
import { LEVEL_TWO_POWER_LASER_FOR_SM2 } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as projectActions } from '../../../flux/project';
import { WORKSPACE_STAGE, actions as workspaceActions } from '../../../flux/workspace';
import { ConnectionType } from '../../../flux/workspace/state';
import { controller } from '../../../communication/socket-communication';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import UniApi from '../../../lib/uni-api';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import Modal from '../../components/Modal';
import modalSmallHOC from '../../components/Modal/modal-small';
import Canvas from '../../components/SMCanvas';
import SvgIcon from '../../components/SvgIcon';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import PrintablePlate from '../WorkspaceVisualizer/PrintablePlate';
import GcodePreviewItem from './GCodeListItem';
import GCodeParams from './GCodeParams';
import LaserStartModal from './LaserStartModal';
import PreviewToRunJobModal from './PreviewToRunJobModal';
import styles from './styles.styl';

const cancelRequestEvent = new CustomEvent('cancelReq');

const visualizerGroup = {
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

declare interface FileTransferViewProps {
    widgetActions: object;
    controlActions: object;
}

const WifiTransport: React.FC<FileTransferViewProps> = (props) => {
    const { widgetActions, controlActions } = props;
    const dispatch = useDispatch();

    const activeMachineToolOptions: MachineToolHeadOptions = useSelector((state: RootState) => state.workspace.activeMachineToolOptions);

    // connection state
    const connectionType: ConnectionType = useSelector((state: RootState) => state.workspace.connectionType);
    const isConnected: boolean = useSelector((state: RootState) => state.workspace.isConnected);

    const isNetworkConnected = isConnected && connectionType === ConnectionType.WiFi;
    const isSerialPortConnected = isConnected && connectionType === ConnectionType.Serial;

    const {
        headType,
        toolHead: toolHeadName,
        isRotate,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const {
        workflowStatus,
        originOffset,
        gcodeFiles,
        previewBoundingBox,
        previewModelGroup,
        previewStage,
        isLaserPrintAutoMode,
    } = useSelector((state: RootState) => state.workspace);

    const useBackground = useSelector((state: RootState) => state.laser?.useBackground);

    //
    const [loadToWorkspaceOnLoad, setLoadToWorkspaceOnLoad] = useState(true);
    const [selectFileName, setSelectFileName] = useState('');
    const [selectFileType, setSelectFileType] = useState('');
    const [selectFileIndex, setSelectFileIndex] = useState(-1);

    const [showPreviewToRunJobModal, setShowPreviewToRunJobModal] = useState(false);

    // Control display of preview modal
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    useEffect(() => {
        if (previewStage === WORKSPACE_STAGE.LOADING_GCODE) {
            setShowPreviewModal(true);
        } else if (previewStage === WORKSPACE_STAGE.EMPTY) {
            setShowPreviewModal(false);
        }
    }, [previewStage]);

    /*
    const closePreviewModal = () => {
        dispatch(workspaceActions.updateState({
            previewStage: WORKSPACE_STAGE.EMPTY
        }));
    };
    */

    const [showStartModal, setShowStartModal] = useState(false);
    const fileInput = useRef();
    const gcodeItemRef = useRef();
    const canvas = useRef();
    const prevProps = usePrevious({
        previewStage
    });

    const onSelectFile = useCallback((_selectFileName, name, event, needToUnselect = true) => {
        if (event && (event.target.className.indexOf('input-select') > -1 || event.target.className.indexOf('fa-check') > -1)) {
            return;
        }
        // this.props.renameGcodeFile(selectFileName, name, false, true);
        const filename = path.basename(_selectFileName);
        let type = '';
        if (filename.endsWith('.gcode')) {
            type = HEAD_PRINTING;
        }
        if (filename.endsWith('.nc')) {
            type = HEAD_LASER;
        }
        if (filename.endsWith('.cnc')) {
            type = HEAD_CNC;
        }
        // select and unselect
        if (selectFileName === _selectFileName && needToUnselect) {
            setSelectFileName('');
            type = '';
        } else {
            setSelectFileName(_selectFileName);
        }
        setSelectFileType(type);
        const selectedFile = gcodeFiles.find(item => item?.uploadName === _selectFileName);
        dispatch(workspaceActions.updateState({
            gcodeFile: selectedFile,
            boundingBox: selectedFile?.boundingBox
        }));
    }, [dispatch, selectFileName, gcodeFiles]);

    const actions = {
        onChangeFile: async (event) => {
            const file = event.target.files[0];

            // if (loadToWorkspaceOnLoad) {
            //     dispatch(workspaceActions.uploadGcodeFile(file));
            // } else {
            //     dispatch( workspaceActions.uploadGcodeFileToList(file));
            // }
            setShowStartModal(false);
            dispatch(workspaceActions.uploadGcodeFileToList(file));
        },
        onClickToUpload: () => {
            if (fileInput.current) {
                fileInput.current.value = null;
                fileInput.current.click();
            }
        },
        onExport: () => {
            if (!selectFileName) {
                return;
            }
            const selectGcodeFile = _.find(gcodeFiles, { uploadName: selectFileName });
            dispatch(projectActions.exportFile(selectFileName, selectGcodeFile.renderGcodeFileName));
        },
        onChangeShouldPreview: () => {
            setLoadToWorkspaceOnLoad(!loadToWorkspaceOnLoad);
        },

        startPrint: async () => {
            if (headType === HEAD_LASER) {
                setShowStartModal(true);
            } else {
                actions.loadGcodeToWorkspace();
            }
        },
        onStartToPrint: async () => {
            if (selectFileType !== headType) {
                setShowPreviewToRunJobModal(true);
                return;
            }
            await actions.startPrint();
        },

        loadGcodeToWorkspace: async (isLaserAutoFocus = false, isCameraCapture = false) => {
            const find = gcodeFiles.find(v => v.uploadName.toLowerCase() === selectFileName.toLowerCase());
            if (!find) {
                log.warn('File not found');
                return;
            }
            await dispatch(workspaceActions.renderGcodeFile(find, false, true));
            await dispatch(workspaceActions.updateState({ activeGcodeFile: find }));
            await dispatch(workspaceActions.updateStateGcodeFileName(find.renderGcodeFileName || find.name));


            if (toolHeadName === LEVEL_TWO_POWER_LASER_FOR_SM2 && isLaserAutoFocus && !isRotate) {
                const { min, max } = find.boundingBox;
                const { x: minX, y: minY } = min;
                const { x: maxX, y: maxY } = max;
                const deltaY = 10;
                const deltaX = 19;
                const z0 = 166;
                const deltaRedLine = 30;
                let x = (maxX + minX) / 2 + z0 / Math.sqrt(3) - deltaRedLine + deltaX / 2;
                let y = (maxY + minY) / 2 + deltaY / 2;
                if (!isCameraCapture) {
                    x -= originOffset.x;
                    y -= originOffset.y;
                }
                const args = {
                    x: x,
                    y: y,
                    feedRate: 1500,
                    isCameraCapture
                };
                window.addEventListener('cancelReq', () => {
                    controller.emitEvent(SocketEvent.AbortMaterialThickness);
                });
                controller.emitEvent(SocketEvent.CalcMaterialThickness, args)
                    .once(SocketEvent.CalcMaterialThickness, ({ data: { status, thickness }, msg }) => {
                        if (msg || !status) {
                            modalSmallHOC({
                                title: i18n._('key-Workspace/WifiTransport-Failed to measure thickness.'),
                                text: i18n._('key-Workspace/WifiTransport-Thickness Measurement failed. Please retry.'),
                                iconColor: '#FF4D4F',
                            });
                        } else if (status) {
                            actions.onChangeMaterialThickness(thickness);
                            actions.onChangeMaterialThicknessSource('auto');
                            controlActions.onCallBackRun();
                        }
                    });
                return;
            }

            controlActions.onCallBackRun();
        },

        importFile: (fileObj) => {
            if (fileObj) {
                actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                actions.onClickToUpload();
            }
        },
        onChangeLaserPrintMode: async () => {
            dispatch(workspaceActions.updateIsLaserPrintAutoMode(!isLaserPrintAutoMode));
        },

        onChangeMaterialThickness: (value) => {
            if (value < 0) {
                // safely setting
                value = 0;
            }
            dispatch(workspaceActions.updateMaterialThickness(value));
        },

        onChangeMaterialThicknessSource: (value) => {
            dispatch(workspaceActions.updateMaterialThicknessSource(value));
        },

        onChangeFourAxisMaterialThickness: async (value) => {
            dispatch(workspaceActions.updateMaterialThickness(value / 2));
        }
    };

    useEffect(() => {
        if (!isConnected) {
            window.dispatchEvent(cancelRequestEvent);
        }
    }, [isConnected]);
    useEffect(() => {
        if (isRotate) {
            dispatch(workspaceActions.updateIsLaserPrintAutoMode(false));
        }
    }, [isRotate, connectionType, toolHeadName]);


    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/WifiTransport-G-code Files'));

        if (gcodeFiles.length > 0) {
            onSelectFile(gcodeFiles[0].uploadName);
        }
        visualizerGroup.object.add(previewModelGroup);
        UniApi.Event.on('appbar-menu:workspace.import', actions.importFile);
        return () => {
            UniApi.Event.off('appbar-menu:workspace.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        if (gcodeFiles.length > 0) {
            const candidate = gcodeFiles[selectFileIndex > -1 ? selectFileIndex : 0];
            const newUploadName = candidate ? candidate.uploadName : gcodeFiles[0].uploadName;
            onSelectFile(newUploadName);
        }
    }, [gcodeFiles]);

    useEffect(() => {
        UniApi.Event.on('appbar-menu:workspace.export-gcode', actions.onExport);
        return () => {
            UniApi.Event.off('appbar-menu:workspace.export-gcode', actions.onExport);
        };
    }, [selectFileName]);

    useEffect(() => {
        if (prevProps) {
            if (prevProps.previewStage !== previewStage && previewStage === WORKSPACE_STAGE.LOAD_GCODE_SUCCEED) {
                if (previewBoundingBox !== null) {
                    const { min, max } = previewBoundingBox;
                    const target = new THREE.Vector3();

                    target.copy(min).add(max).divideScalar(2);
                    const width = new THREE.Vector3().add(min).distanceTo(new THREE.Vector3().add(max));
                    const position = new THREE.Vector3(target.x, target.y, width * 2);
                    // Pop up display driven by redux
                    // Use setTimeout to wait for the canvas pop-up window to load
                    setTimeout(() => {
                        canvas.current && canvas.current.setCamera(position, target);
                    });
                }
            }
        }
    }, [previewStage]);

    // Wi-Fi transfer file to Snapmaker
    /**
     * Start to send G-code File.
     */
    const onStartToSendFile = useCallback(() => {
        const isSendingFile = modalSmallHOC({
            title: i18n._('key-Workspace/WifiTransport-Sending File'),
            text: i18n._('key-Workspace/WifiTransport-Sending file. Please wait…'),
            iconColor: '#4CB518',
            img: 'WarningTipsProgress'
        }).ref;

        const find = gcodeFiles.find(v => v.uploadName === selectFileName);
        if (!find) {
            return;
        }

        controller
            .emitEvent(SocketEvent.UploadFile, {
                filePath: find.uploadName,
                targetFilename: find.renderGcodeFileName,
            })
            .once(SocketEvent.UploadFile, ({ err, text }) => {
                isSendingFile.current && isSendingFile.current.removeContainer();
                if (err) {
                    modalSmallHOC({
                        title: i18n._('key-Workspace/WifiTransport-Failed to send file.'),
                        text: text,
                        iconColor: '#FF4D4F',
                        img: 'WarningTipsError'
                    });
                } else {
                    modalSmallHOC({
                        title: i18n._('key-Workspace/WifiTransport-File sent successfully.'),
                        text: i18n._('key-Workspace/WifiTransport-Your file was successfully sent. Receive it on the Touchscreen.'),
                        iconColor: '#4CB518',
                        img: 'WarningTipsSuccess'
                    });
                }
            });
    }, [gcodeFiles, selectFileName]);

    const hasFile = gcodeFiles.length > 0;
    const selectedFile = _.find(gcodeFiles, { uploadName: selectFileName });

    const canStartPrint = useMemo(() => {
        if (!hasFile || !selectedFile) {
            return false;
        }

        if (activeMachineToolOptions) {
            const disabled = activeMachineToolOptions.disableRemoteStartPrint || false;
            if (disabled) {
                return false;
            }
        }

        if (!isConnected) {
            return false;
        }

        // workflow status
        return includes([WorkflowStatus.Idle], workflowStatus);
    }, [hasFile, selectedFile, isConnected, activeMachineToolOptions, workflowStatus]);

    const canSend = hasFile && selectedFile && isNetworkConnected;

    const selectedGCodeFile = gcodeFiles[selectFileIndex >= 0 ? selectFileIndex : 0];

    const onConfirm = async (type) => {
        let isLaserAutoFocus = false;
        switch (type) {
            case AUTO_MDOE:
                isLaserAutoFocus = true;
                dispatch(workspaceActions.updateIsLaserPrintAutoMode(true));
                dispatch(workspaceActions.updateMaterialThickness(0));
                break;
            case SEMI_AUTO_MODE:
                isLaserAutoFocus = false;
                await dispatch(workspaceActions.updateIsLaserPrintAutoMode(toolHeadName !== LEVEL_TWO_POWER_LASER_FOR_SM2));
                break;
            case MANUAL_MODE:
                isLaserAutoFocus = false;
                await dispatch(workspaceActions.updateIsLaserPrintAutoMode(false));
                await dispatch(workspaceActions.updateMaterialThickness(-1));
                break;
            default:
        }
        actions.loadGcodeToWorkspace(isLaserAutoFocus, useBackground);
    };

    return (
        <div className="border-default-grey-1 border-radius-8">
            <input
                ref={fileInput}
                type="file"
                accept=".gcode,.nc,.cnc"
                style={{ display: 'none' }}
                multiple={false}
                onChange={actions.onChangeFile}
            />
            <div className={classNames('height-176-default', 'position-re', 'overflow-y-auto')}>
                {!hasFile && (
                    <div className={styles['import-btn-dashed']}>
                        <Button type="dashed" width="210px" priority="level-two" onClick={actions.onClickToUpload}>
                            <SvgIcon
                                name="Increase"
                                size={22}
                                type={['static']}
                            />
                            <span>{i18n._('key-Workspace/WifiTransport-G-code Files')}</span>
                        </Button>
                    </div>
                )}
                {hasFile && (
                    _.map(gcodeFiles, (gcodeFile, index) => {
                        return (
                            <React.Fragment key={index}>
                                <GcodePreviewItem
                                    gcodeFile={gcodeFile}
                                    index={index}
                                    selected={selectFileName === gcodeFile.uploadName}
                                    onSelectFile={onSelectFile}
                                    gRef={gcodeItemRef}
                                    setSelectFileIndex={setSelectFileIndex}
                                />
                            </React.Fragment>
                        );
                    })
                )}
            </div>
            <div className={classNames('height-only-96', 'box-shadow-default', 'padding-top-8', 'padding-horizontal-16', 'padding-bottom-16')}>
                <div className={classNames('sm-flex', 'justify-space-between', 'align-center')}>
                    <SvgIcon
                        name="Edit"
                        size={24}
                        title={i18n._('key-Workspace/Transport-Edit')}
                        disabled={!selectedFile}
                        onClick={(e) => gcodeItemRef.current.remaneStart(selectedFile.uploadName, selectFileIndex, e)}
                    />
                    <SvgIcon
                        name="Import"
                        size={24}
                        title={i18n._('key-Workspace/Transport-Import')}
                        onClick={actions.onClickToUpload}
                    />
                    <SvgIcon
                        name="Export"
                        size={24}
                        title={i18n._('key-Workspace/Transport-Export')}
                        onClick={actions.onExport}
                        disabled={!selectedFile}
                    />
                    <SvgIcon
                        name="Delete"
                        size={24}
                        title={i18n._('key-Workspace/Transport-Delete')}
                        disabled={!selectedFile}
                        onClick={() => gcodeItemRef.current.removeFile(selectedFile)}
                    />
                </div>
                <div className={classNames('sm-flex', 'justify-space-between', 'align-center', 'margin-top-8')}>
                    <Button
                        type="primary"
                        priority="level-three"
                        width="144px"
                        disabled={!canSend}
                        onClick={onStartToSendFile}
                    >
                        {i18n._('key-Workspace/WifiTransport-Sending File')}
                    </Button>
                    <Button
                        type="primary"
                        priority="level-two"
                        width="144px"
                        disabled={!canStartPrint}
                        onClick={actions.onStartToPrint}
                    >
                        {i18n._('Start on Luban')}
                    </Button>
                </div>
            </div>
            <LaserStartModal
                showStartModal={showStartModal}
                isHeightPower={toolHeadName === LEVEL_TWO_POWER_LASER_FOR_SM2}
                isRotate={isRotate}
                isSerialConnect={isSerialPortConnected}
                onClose={() => setShowStartModal(false)}
                onConfirm={async (type) => onConfirm(type)}
            />
            {/* Modal that displays selected file */}
            {
                showPreviewModal && (
                    <PreviewModal
                        gcodeFile={selectedGCodeFile}
                        onStartToSendFile={onStartToSendFile}
                        onStartToPrint={actions.onStartToPrint}
                        canStartPrint={canStartPrint}
                        canSend={canSend}
                    />
                )
            }
            {
                showPreviewToRunJobModal && (
                    <PreviewToRunJobModal
                        selectFileType={selectFileType}
                        headType={headType}
                        onClose={() => setShowPreviewToRunJobModal(false)}
                        onConfirm={actions.startPrint}
                    />
                )
            }
        </div>
    );
};

export default WifiTransport;
