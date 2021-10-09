import React, { useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import * as THREE from 'three';
import { Spin } from 'antd';

import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import path from 'path';
import request from 'superagent';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import { normalizeNameDisplay } from '../../../lib/normalize-range';
import styles from './index.styl';
import {
    CONNECTION_TYPE_WIFI,
    DATA_PREFIX, HEAD_CNC, HEAD_LASER, HEAD_PRINTING
} from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';

import modalSmallHOC from '../../components/Modal/modal-small';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Menu from '../../components/Menu';
import Dropdown from '../../components/Dropdown';
import Modal from '../../components/Modal';
import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../WorkspaceVisualizer/PrintablePlate';
// import Checkbox from '../../components/Checkbox';


const changeNameInput = [];

const GcodePreviewItem = React.memo(({ gcodeFile, index, selected, onSelectFile, gRef, setSelectFileIndex, handlePreviewModalShow }) => {
    const dispatch = useDispatch();
    // const name = gcodeFile.name.length > 25
    //     ? `${gcodeFile.name.substring(0, 15)}...${gcodeFile.name.substring(gcodeFile.name.length - 10, gcodeFile.name.length)}`
    //     : gcodeFile.name;
    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(gcodeFile.name, suffixLength);
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
        const m = _uploadName.match(/(.gcode|.cnc|.nc)$/);
        if (m) {
            newName += m[0];
        }
        dispatch(workspaceActions.renameGcodeFile(_uploadName, newName, false));
    };

    const onRenameStart = (_uploadName, _index, event) => {
        dispatch(workspaceActions.renameGcodeFile(_uploadName, null, true));
        event.stopPropagation();
        setTimeout(() => {
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
                <img
                    src={gcodeFile.thumbnail}
                    draggable="false"
                    alt=""
                />
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
                    // onClick={(event) => onRenameStart(uploadName, index, event)}
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
                        defaultValue={gcodeFile.name.replace(/(.gcode|.cnc|.nc)$/, '')}
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
                    handlePreviewModalShow(true);
                    // dispatch.renderPreviewGcodeFile()
                    dispatch(workspaceActions.renderPreviewGcodeFile(gcodeFile, index));
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
    handlePreviewModalShow: PropTypes.func
};

const visualizerGroup = {
    object: new THREE.Group()
};
let printableArea = null;
function WifiTransport({ widgetActions, controlActions }) {
    const { gcodeFiles, previewModelGroup, previewRenderState } = useSelector(state => state.workspace);
    const { server, isConnected, headType, connectionType, size, workflowStatus, workflowState } = useSelector(state => state.machine);
    const [loadToWorkspaceOnLoad, setLoadToWorkspaceOnLoad] = useState(true);
    const [selectFileName, setSelectFileName] = useState('');
    const [selectFileType, setSelectFileType] = useState('');
    const [selectFileIndex, setSelectFileIndex] = useState(-1);
    const [previewModalShow, setPreviewModalShow] = useState(false);
    const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState('');
    const dispatch = useDispatch();
    const fileInput = useRef();
    const gcodeItemRef = useRef();
    const canvas = useRef();
    printableArea = new PrintablePlate({
        x: size.x * 2,
        y: size.y * 2
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
        } else {
            setSelectFileName(_selectFileName);
        }
        setSelectFileType(type);
    }, [selectFileName]);

    const actions = {
        onChangeFile: async (event) => {
            const file = event.target.files[0];

            // if (loadToWorkspaceOnLoad) {
            //     dispatch(workspaceActions.uploadGcodeFile(file));
            // } else {
            //     dispatch(workspaceActions.uploadGcodeFileToList(file));
            // }
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
            dispatch(projectActions.exportFile(selectFileName));
        },
        onChangeShouldPreview: () => {
            setLoadToWorkspaceOnLoad(!loadToWorkspaceOnLoad);
        },

        loadGcodeToWorkspace: async () => {
            const find = gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            await dispatch(workspaceActions.renderGcodeFile(find, false));
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
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            request.get(gcodePath).end((err1, res) => {
                const gcode = res.text;
                const blob = new Blob([gcode], { type: 'text/plain' });
                const file = new File([blob], find.name);
                server.uploadFile(find.name, file, (err, data, text) => {
                    isSendingFile.current.removeContainer();
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
        }
    };

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
        const newCurrent = connectionType === 'wifi' ? workflowStatus : workflowState;
        setCurrentWorkflowStatus(newCurrent);
    }, [workflowState, workflowStatus, connectionType]);

    // useEffect(() => {
    //     visualizerGroup.object.add(previewModalShow);
    // }, [previewModelGroup]);

    const isHeadType = selectFileType === headType;
    const hasFile = gcodeFiles.length > 0;
    const selectedFile = _.find(gcodeFiles, { uploadName: selectFileName });
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
            {/* <Button
                width="160px"
                type="primary"
                className="margin-bottom-8 display-inline"
                priority="level-three"
                onClick={actions.onClickToUpload}
            >
                {i18n._('key-Workspace/WifiTransport-Open G-code')}
            </Button>
            <Button
                width="160px"
                type="primary"
                className="margin-bottom-8 display-inline margin-left-8"
                priority="level-three"
                onClick={actions.onExport}
            >
                {i18n._('key-Workspace/WifiTransport-Export G-code')}
            </Button>
            <div className="margin-bottom-8">
                <Checkbox
                    checked={loadToWorkspaceOnLoad}
                    onChange={actions.onChangeShouldPreview}
                />
                <span className="margin-left-8">{i18n._('key-Workspace/WifiTransport-Preview in Workspace')}</span>
            </div>
            {
                _.map(gcodeFiles, (gcodeFile, index) => {
                    return (
                        <React.Fragment key={index}>
                            <GcodePreviewItem
                                gcodeFile={gcodeFile}
                                index={index}
                                selected={selectFileName === gcodeFile.uploadName}
                                onSelectFile={onSelectFile}
                            />
                        </React.Fragment>
                    );
                })
            }
            <Button
                type="primary"
                className="margin-vertical-8"
                priority="level-two"
                disabled={!hasFile}
                onClick={actions.loadGcodeToWorkspace}
            >
                {i18n._('key-Workspace/WifiTransport-Load G-code to Workspace')}
            </Button>
            <Button
                type="primary"
                className="margin-bottom-16"
                priority="level-two"
                disabled={!(hasFile && isConnected && isHeadType && connectionType === CONNECTION_TYPE_WIFI)}
                onClick={actions.sendFile}
            >
                {i18n._('Send to Device via Wi-Fi')}
            </Button> */}
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
                                    // handlePreviewModalShow={controlActions.onPreviewModalShow}
                                    handlePreviewModalShow={setPreviewModalShow}
                                />
                            </React.Fragment>
                        );
                    })
                )}
            </div>
            <div className={classNames('height-88', 'box-shadow-default', 'padding-top-8', 'padding-horizontal-16', 'padding-bottom-16')}>
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
                        disabled={!(hasFile && isConnected && isHeadType && connectionType === CONNECTION_TYPE_WIFI)}
                        onClick={actions.sendFile}
                    >
                        {i18n._('key-Workspace/WifiTransport-Sending File')}
                    </Button>
                    <Button
                        type="primary"
                        priority="level-two"
                        width="144px"
                        disabled={!hasFile || !isConnected || currentWorkflowStatus !== 'idle'}
                        onClick={actions.loadGcodeToWorkspace}
                    >
                        {i18n._('key-Workspace/Transport-Start Print')}
                    </Button>
                </div>
            </div>
            <Modal
                centered
                visible={previewModalShow}
                onClose={() => {
                    setPreviewModalShow(false);
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
                        {previewRenderState !== 'rendered' && (
                            <div className="position-ab position-ab-center">
                                <Spin />
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button priority="level-three" width="88px" onClick={() => setPreviewModalShow(false)} className="margin-right-16">{i18n._('key-unused-Cancel')}</Button>
                    {(currentWorkflowStatus !== 'idle' || connectionType === 'serial') && <Button priority="level-two" type="primary" width="200px">{i18n._('key-Workspace/WifiTransport-Sending File')}</Button>}
                    {(currentWorkflowStatus === 'idle' && connectionType === 'wifi') && (
                        <Dropdown
                            className="display-inline"
                            overlay={() => (
                                <Menu>
                                    <Menu.Item onClick={() => {
                                        actions.sendFile();
                                        setPreviewModalShow(false);
                                    }}
                                    >
                                        <div className="align-c">{i18n._('key-Workspace/WifiTransport-Sending File')}</div>
                                    </Menu.Item>
                                </Menu>
                            )}
                            trigger="hover"
                        >
                            <Button
                                suffixIcon={<SvgIcon name="DropdownOpen" type={['static']} color="#d5d6d9" />}
                                priority="level-two"
                                type="primary"
                                width="200px"
                                onClick={() => {
                                    actions.loadGcodeToWorkspace();
                                    setPreviewModalShow(false);
                                }}
                            >
                                {i18n._('key-Workspace/Transport-Start Print')}
                            </Button>
                        </Dropdown>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
}
WifiTransport.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    controlActions: PropTypes.object
};

export default WifiTransport;
