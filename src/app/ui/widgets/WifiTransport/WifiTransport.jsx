import React, { useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import * as THREE from 'three';
import { Spin } from 'antd';

import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import path from 'path';
import { controller } from '../../../lib/controller';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import { normalizeNameDisplay } from '../../../lib/normalize-range';
import styles from './index.styl';
import {
    CONNECTION_TYPE_WIFI, WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_IDLE,
    HEAD_CNC, HEAD_LASER, HEAD_PRINTING,
    LEVEL_TWO_POWER_LASER_FOR_SM2, CONNECTION_MATERIALTHICKNESS_ABORT,
    CONNECTION_TYPE_SERIAL, CONNECTION_MATERIALTHICKNESS, CONNECTION_UPLOAD_FILE
} from '../../../constants';
import { actions as workspaceActions, WORKSPACE_STAGE } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';

import modalSmallHOC from '../../components/Modal/modal-small';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Menu from '../../components/Menu';
import Dropdown from '../../components/Dropdown';
import Modal from '../../components/Modal';
import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../WorkspaceVisualizer/PrintablePlate';
import usePrevious from '../../../lib/hooks/previous';
import { actions as machineActions } from '../../../flux/machine';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import GCodeParams from './GCodeParams';
import PreviewToRunJobModal from './PreviewToRunJobModal';
import LaserStartModal from './LaserStartModal';
import LaserLevelingMode from './LaserLevelingMode';

const changeNameInput = [];
const suffixLength = 7;
const cancelRequestEvent = new CustomEvent('cancelReq');
const GcodePreviewItem = React.memo(({ gcodeFile, index, selected, onSelectFile, gRef, setSelectFileIndex }) => {
    const dispatch = useDispatch();
    const { prefixName, suffixName } = normalizeNameDisplay(gcodeFile?.renderGcodeFileName || gcodeFile?.name, suffixLength);

    let size = '';
    const { isRenaming, uploadName } = gcodeFile;
    if (!gcodeFile.size) {
        size = '';
    } else if (gcodeFile.size / 1024 / 1024 > 1) {
        size = `${(gcodeFile.size / 1024 / 1024).toFixed(2)} MB`;
    } else if (gcodeFile.size / 1024 > 1) {
        size = `${(gcodeFile.size / 1024).toFixed(2)} KB`;
    } else {
        size = `${(gcodeFile.size).toFixed(2)} B`;
    }

    const lastModified = new Date(gcodeFile.lastModified);
    let date = `${lastModified.getFullYear()}.${lastModified.getMonth() + 1}.${lastModified.getDate()}   ${lastModified.getHours()}:${lastModified.getMinutes()}`;
    if (!gcodeFile.lastModified) {
        date = '';
    }

    const onKeyDown = (e) => {
        let keynum;
        if (window.event) {
            keynum = e.keyCode;
        } else if (e.which) {
            keynum = e.which;
        }
        if (keynum === 13) {
            e.target.blur();
        }
    };

    const onRenameEnd = (_uploadName, _index) => {
        let newName = changeNameInput[_index].current.value;
        const m = _uploadName.match(/(\.gcode|\.cnc|\.nc)$/);
        if (m) {
            newName += m[0];
        }
        dispatch(workspaceActions.renameGcodeFile(_uploadName, newName, false));
    };

    const onRenameStart = (_uploadName, _index, _renderGcodeFileName = '', event) => {
        dispatch(workspaceActions.renameGcodeFile(_uploadName, null, true));
        event.stopPropagation();
        setTimeout(() => {
            changeNameInput[_index].current.value = _.replace(_renderGcodeFileName, /(\.gcode|\.cnc|\.nc)$/, '') || _uploadName;
            changeNameInput[_index].current.focus();
        }, 0);
    };

    const onRemoveFile = (_gcodeFile) => {
        dispatch(workspaceActions.removeGcodeFile(_gcodeFile));
    };

    useImperativeHandle(gRef, () => ({
        remaneStart: (_uploadName, _index, e) => onRenameStart(_uploadName, _index, e),
        removeFile: (_gcodeFile) => onRemoveFile(_gcodeFile)
    }));

    useEffect(() => {
        if (selected) {
            setSelectFileIndex(index);
        }
    }, [selected]);

    return (
        <div
            className={classNames(
                styles['gcode-file'],
                { [styles.selected]: selected }
            )}
            key={pathWithRandomSuffix(gcodeFile.uploadName)}
            onClick={
                (event) => onSelectFile(gcodeFile.uploadName, null, event)
            }
            onKeyDown={noop}
            role="button"
            tabIndex={0}
        >
            {/* <button
                type="button"
                className={styles['gcode-file-remove']}
                onClick={() => {
                    onRemoveFile(gcodeFile);
                }}
            /> */}
            {/* {selected && <div className={styles['gcode-file-selected-icon']} />} */}

            <div className={styles['gcode-file-img']}>
                {gcodeFile.thumbnail && (
                    <img
                        src={gcodeFile.thumbnail}
                        draggable="false"
                        alt=""
                    />
                )}
            </div>
            <div className={classNames('input-text', styles['gcode-file-text'])}>
                <div
                    className={classNames(
                        styles['gcode-file-text-name'],
                        { [styles.haveOpacity]: isRenaming === false }
                    )}
                    role="button"
                    onKeyDown={() => {
                    }}
                    tabIndex={0}
                >
                    <div
                        className={styles['gcode-file-text-rename']}
                    >
                        {/* {name} */}
                        <span className={classNames(styles['prefix-name'])}>
                            {prefixName}
                        </span>
                        <span className={classNames(styles['suffix-name'])}>
                            {suffixName}
                        </span>
                    </div>

                </div>
                <div className={classNames(
                    styles['gcode-file-input-name'],
                    { [styles.haveOpacity]: isRenaming === true }
                )}
                >
                    <input
                        defaultValue={gcodeFile?.renderGcodeFileName?.replace(/(\.gcode|\.cnc|\.nc)$/, '')}
                        className={classNames('input-select')}
                        onBlur={() => onRenameEnd(uploadName, index)}
                        onKeyDown={(event) => onKeyDown(event)}
                        ref={changeNameInput[index]}
                    />
                </div>
                <div className={styles['gcode-file-text-info']}>
                    <span>{size}</span>
                    <span>{date}</span>
                </div>
            </div>
            <SvgIcon
                name="PreviewGcode"
                // name="MainToolbarHome"
                type={['static']}
                className="height-48 position-ab right-16"
                size={24}
                onClick={e => {
                    e.stopPropagation();
                    onSelectFile(gcodeFile.uploadName, null, null, false);
                    dispatch(workspaceActions.renderPreviewGcodeFile(gcodeFile));
                }}
            />
        </div>
    );
});
GcodePreviewItem.propTypes = {
    gcodeFile: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    selected: PropTypes.bool.isRequired,
    onSelectFile: PropTypes.func.isRequired,
    gRef: PropTypes.object.isRequired,
    setSelectFileIndex: PropTypes.func.isRequired,
};

const visualizerGroup = {
    object: new THREE.Group()
};
let printableArea = null;
function WifiTransport({ widgetActions, controlActions }) {
    const dispatch = useDispatch();
    // const [isLaserAutoFocus, setIsLaserAutoFocus] = useState(true);
    const isLaserPrintAutoMode = useSelector(state => state?.machine?.isLaserPrintAutoMode);
    const originOffset = useSelector(state => state?.machine?.originOffset);
    const toolHeadName = useSelector(state => state?.workspace?.toolHead);
    const { previewBoundingBox, headType, gcodeFiles, previewModelGroup, previewRenderState, previewStage, isRotate } = useSelector(state => state.workspace);
    const { isConnected, connectionType, size, workflowStatus, isSendedOnWifi } = useSelector(state => state.machine);
    const [loadToWorkspaceOnLoad, setLoadToWorkspaceOnLoad] = useState(true);
    const [selectFileName, setSelectFileName] = useState('');
    const [selectFileType, setSelectFileType] = useState('');
    const [selectFileIndex, setSelectFileIndex] = useState(-1);

    const [isUnknownGCodeType, setIsUnknownGCodeType] = useState(false);
    const [isGCdoeFileMatchToolHead, setIsGCdoeFileMatchToolHead] = useState(false);
    const [showPreviewToRunJobModal, setShowPreviewToRunJobModal] = useState(false);

    const [showPreviewModal, setShowPreviewModal] = useState(false);
    useEffect(() => {
        if (previewStage === WORKSPACE_STAGE.LOADING_GCODE) {
            setShowPreviewModal(true);
        } else if (previewStage === WORKSPACE_STAGE.EMPTY) {
            setShowPreviewModal(false);
        }
    }, [previewStage]);

    const closePreviewModal = () => {
        dispatch(workspaceActions.updateState({
            previewStage: WORKSPACE_STAGE.EMPTY
        }));
    };
    const [showStartModal, setShowStartModal] = useState(false);
    const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState('');
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
        const gcodeFile = gcodeFiles.find(item => item?.uploadName === _selectFileName);
        dispatch(workspaceActions.updateState({
            gcodeFile: gcodeFile,
            boundingBox: gcodeFile?.boundingBox
        }));
    }, [selectFileName, gcodeFiles]);

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
            fileInput.current.value = null;
            fileInput.current.click();
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
        matchingGCodeTypeAndHeadType: async () => {
            if (isUnknownGCodeType || !isGCdoeFileMatchToolHead) {
                setShowPreviewToRunJobModal(true);
                return;
            }
            await actions.startPrint();
        },

        loadGcodeToWorkspace: async (isLaserAutoFocus) => {
            const find = gcodeFiles.find(v => v.uploadName.toLowerCase() === selectFileName.toLowerCase());
            if (!find) {
                return;
            }
            await dispatch(workspaceActions.renderGcodeFile(find, false, true));

            if (toolHeadName === LEVEL_TWO_POWER_LASER_FOR_SM2 && isLaserAutoFocus && !isRotate) {
                const { min, max } = find.boundingBox;
                const { x: minX, y: minY } = min;
                const { x: maxX, y: maxY } = max;
                const deltaY = 10;
                const deltaX = 19;
                const z0 = 166;
                const deltaRedLine = 30;
                const x = (maxX + minX) / 2 - originOffset.x + z0 / Math.sqrt(3) - deltaRedLine + deltaX / 2;
                const y = (maxY + minY) / 2 - originOffset.y + deltaY / 2;
                const args = {
                    x: x,
                    y: y,
                    feedRate: 1500
                };
                window.addEventListener('cancelReq', () => {
                    controller.emitEvent(CONNECTION_MATERIALTHICKNESS_ABORT);
                });
                controller.emitEvent(CONNECTION_MATERIALTHICKNESS, args)
                    .once(CONNECTION_MATERIALTHICKNESS, ({ data }) => {
                        const { status, thickness } = data;
                        // TODO: if status is false, will not start print in this logic
                        if (status) {
                            actions.onChangeMaterialThickness(thickness);
                            controlActions.onCallBackRun();
                        }
                    });
                return;
            }
            controlActions.onCallBackRun();
        },

        // Wi-Fi transfer file to Snapmaker
        sendFile: () => {
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
            const gcodePath = `/${find.uploadName}`;
            controller.emitEvent(CONNECTION_UPLOAD_FILE, { gcodePath: gcodePath, renderGcodeFileName: find.renderGcodeFileName })
                .once(CONNECTION_UPLOAD_FILE, ({ err, text }) => {
                    isSendingFile.current && isSendingFile.current.removeContainer();
                    if (err) {
                        modalSmallHOC({
                            title: i18n._('key-Workspace/WifiTransport-Failed to send file.'),
                            text: text,
                            iconColor: '#FF4D4F',
                            img: 'WarningTipsError'
                        });
                    } else {
                        (modalSmallHOC({
                            title: i18n._('key-Workspace/WifiTransport-File sent successfully.'),
                            text: i18n._('key-Workspace/WifiTransport-Your file was successfully sent. Receive it on the Touchscreen.'),
                            iconColor: '#4CB518',
                            img: 'WarningTipsSuccess'
                        }));
                    }
                });
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
            dispatch(machineActions.updateIsLaserPrintAutoMode(!isLaserPrintAutoMode));
        },

        onChangeMaterialThickness: (value) => {
            if (value < 0) {
                // safely setting
                value = 0;
            }
            dispatch(machineActions.updateMaterialThickness(value));
        },

        onChangeFourAxisMaterialThickness: async (value) => {
            dispatch(machineActions.updateMaterialThickness(value / 2));
        }
    };

    useEffect(() => {
        if (!isConnected) {
            window.dispatchEvent(cancelRequestEvent);
        }
    }, [isConnected]);
    useEffect(() => {
        // if (connectionType === CONNECTION_TYPE_SERIAL || isRotate || toolHeadName !== LEVEL_TWO_POWER_LASER_FOR_SM2) {
        //     setIsLaserAutoFocus(false);
        //     dispatch(machineActions.updateIsLaserPrintAutoMode(false));
        // } else {
        //     setIsLaserAutoFocus(true);
        //     dispatch(machineActions.updateIsLaserPrintAutoMode(true));
        // }
        if (isRotate) {
            dispatch(machineActions.updateIsLaserPrintAutoMode(false));
        }
    }, [isRotate, connectionType, toolHeadName]);

    useEffect(() => {
        printableArea = new PrintablePlate({
            x: size.x * 2,
            y: size.y * 2
        });
    }, [size]);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/WifiTransport-G-code Files'));

        for (let i = 0; i < 5; i++) {
            changeNameInput[i] = React.createRef();
        }
        if (gcodeFiles.length > 0) {
            onSelectFile(gcodeFiles[0].uploadName);
        }
        visualizerGroup.object.add(previewModelGroup);
        UniApi.Event.on('appbar-menu:workspace.import', actions.importFile);
        return () => {
            for (let i = 0; i < 5; i++) {
                changeNameInput[i] = null;
            }
            UniApi.Event.off('appbar-menu:workspace.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        if (gcodeFiles.length > 0) {
            const newUploadName = gcodeFiles[selectFileIndex > -1 ? selectFileIndex : 0] ? gcodeFiles[selectFileIndex > -1 ? selectFileIndex : 0].uploadName : gcodeFiles[0].uploadName;
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
        // const newCurrent = connectionType === 'wifi' ? workflowStatus : workflowState;
        setCurrentWorkflowStatus(workflowStatus);
    }, [workflowStatus]);

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

    const isHeadType = selectFileType === headType;
    const hasFile = gcodeFiles.length > 0;
    const selectedFile = _.find(gcodeFiles, { uploadName: selectFileName });
    const isWifi = connectionType && connectionType === CONNECTION_TYPE_WIFI;
    // TODO: what is isSendedOnWifi?
    const isSended = isWifi ? isSendedOnWifi : true;
    // console.log({ currentWorkflowStatus, isConnected, isSended });
    const canPlay = hasFile && isConnected && isSended && _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_IDLE], currentWorkflowStatus);
    const canSend = hasFile && isConnected && isHeadType && isWifi && isSendedOnWifi;



    useEffect(() => {
        const matchMap = {
            '3dp': HEAD_PRINTING, //  'printing';
            'laser': HEAD_LASER,
            'cnc': HEAD_CNC,
        };
        const gcodeType = gcodeFiles[selectFileIndex] && gcodeFiles[selectFileIndex].type;

        setIsUnknownGCodeType(!Object.keys(matchMap).includes(gcodeType));
        setIsGCdoeFileMatchToolHead(headType === matchMap[gcodeType]);
    }, [headType, selectFileIndex]);

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
                        onClick={actions.sendFile}
                    >
                        {i18n._('key-Workspace/WifiTransport-Sending File')}
                    </Button>
                    <Button
                        type="primary"
                        priority="level-two"
                        width="144px"
                        disabled={!canPlay}
                        onClick={actions.matchingGCodeTypeAndHeadType}
                    >
                        {i18n._('key-Workspace/Transport-Start Print')}
                    </Button>
                </div>
            </div>
            <LaserStartModal
                showStartModal={showStartModal}
                isHeightPower={toolHeadName === LEVEL_TWO_POWER_LASER_FOR_SM2}
                isRotate={isRotate}
                isSerialConnect={connectionType && connectionType === CONNECTION_TYPE_SERIAL}
                onClose={() => setShowStartModal(false)}
                onConfirm={(type) => {
                    const { AUTO_MDOE, SEMI_AUTO_MODE, MANUAL_MODE } = LaserLevelingMode;
                    let isLaserAutoFocus = false;
                    // if (connectionType === CONNECTION_TYPE_SERIAL || isRotate || toolHeadName !== LEVEL_TWO_POWER_LASER_FOR_SM2) {
                    //     dispatch(machineActions.updateIsLaserPrintAutoMode(false));
                    // } else {
                    //     isLaserAutoFocus = true
                    //     dispatch(machineActions.updateIsLaserPrintAutoMode(true));
                    // }
                    switch (type) {
                        case AUTO_MDOE:
                            isLaserAutoFocus = true;
                            dispatch(machineActions.updateIsLaserPrintAutoMode(true));
                            dispatch(machineActions.updateMaterialThickness(0));
                            break;
                        case SEMI_AUTO_MODE:
                            isLaserAutoFocus = false;
                            dispatch(machineActions.updateIsLaserPrintAutoMode(toolHeadName !== LEVEL_TWO_POWER_LASER_FOR_SM2));
                            break;
                        case MANUAL_MODE:
                            isLaserAutoFocus = false;
                            dispatch(machineActions.updateIsLaserPrintAutoMode(false));
                            dispatch(machineActions.updateMaterialThickness(0));
                            break;
                        default:
                    }
                    actions.loadGcodeToWorkspace(isLaserAutoFocus);
                }}
            />
            {showPreviewModal && (
                <Modal
                    centered
                    visible={showPreviewModal}
                    onClose={() => {
                        closePreviewModal();
                    }}
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
                                <div className={classNames('position-ab', 'left-8', 'bottom-8')}>
                                    <SecondaryToolbar
                                        zoomIn={() => canvas.current.zoomIn()}
                                        zoomOut={() => canvas.current.zoomOut()}
                                        toFront={() => canvas.current.autoFocus(previewModelGroup.children[0], true)}
                                    />
                                </div>
                            )}
                            {previewRenderState !== 'rendered' && (
                                <div className="position-ab position-ab-center">
                                    <Spin />
                                </div>
                            )}
                            <GCodeParams gcodeFile={gcodeFiles[selectFileIndex] || {}} />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button priority="level-two" type="default" width="88px" onClick={() => closePreviewModal()} className="margin-right-8">{i18n._('key-unused-Cancel')}</Button>
                        {isConnected && (currentWorkflowStatus !== WORKFLOW_STATUS_IDLE && connectionType === CONNECTION_TYPE_WIFI) && <Button priority="level-two" type="primary" width="200px" onClick={actions.sendFile}>{i18n._('key-Workspace/WifiTransport-Sending File')}</Button>}
                        {isConnected && (currentWorkflowStatus === WORKFLOW_STATUS_IDLE && connectionType === CONNECTION_TYPE_WIFI) && (
                            <Dropdown
                                className="display-inline"
                                overlay={() => (
                                    <Menu>
                                        {canSend && (
                                            <Menu.Item
                                                onClick={() => {
                                                    actions.sendFile();
                                                    closePreviewModal();
                                                }}
                                            >
                                                <div className="align-c">{i18n._('key-Workspace/WifiTransport-Sending File')}</div>
                                            </Menu.Item>
                                        )}
                                        <Menu.Item onClick={() => {
                                            actions.matchingGCodeTypeAndHeadType();
                                            closePreviewModal();
                                        }}
                                        >
                                            <div className="align-c">{i18n._('key-Workspace/Transport-Luban control print')}</div>
                                        </Menu.Item>
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
                        )}
                        {isConnected && (currentWorkflowStatus === WORKFLOW_STATE_IDLE && connectionType === CONNECTION_TYPE_SERIAL) && (
                            <Button
                                priority="level-two"
                                type="primary"
                                width="200px"
                                onClick={() => {
                                    actions.matchingGCodeTypeAndHeadType();
                                    closePreviewModal();
                                }}
                            >
                                <div className="align-c">{i18n._('key-Workspace/Transport-Luban control print')}</div>
                            </Button>
                        )}
                    </Modal.Footer>
                </Modal>
            )}
            {showPreviewToRunJobModal && (
                <PreviewToRunJobModal
                    isMismatchHead={!isUnknownGCodeType}
                    isUnKownHead={headType !== HEAD_CNC && headType !== HEAD_LASER && headType !== HEAD_PRINTING}
                    gcodeType={gcodeFiles[selectFileIndex] && gcodeFiles[selectFileIndex].type}
                    headType={headType}
                    onClose={() => { setShowPreviewToRunJobModal(false); }}
                    onConfirm={() => { actions.startPrint(); }}
                />
            )}
        </div>
    );
}
WifiTransport.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    controlActions: PropTypes.object
};

export default WifiTransport;
