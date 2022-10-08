import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';
import { noop, find } from 'lodash';
import { Progress } from 'antd';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
import { actions as appGlobalActions } from '../../../flux/app-global';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
// import UniApi from '../../../lib/uni-api';

function openFolder(savedModalFilePath) {
    const path = window.require('path');
    const ipc = window.require('electron').ipcRenderer;
    ipc.send('open-saved-path', path.dirname(savedModalFilePath));
}

function pauseDownload(arr) {
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.invoke('pauseDownload', arr);
}
function resumeDownload(arr) {
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.invoke('resumeDownload', arr);
}
function startDownload(list) {
    const { ipcRenderer } = window.require('electron');
    delete list.state;
    ipcRenderer.invoke('startDownload', list);
}

function DonwloadList({ onClose = noop }) {
    const downloadFiles = useSelector(state => state.appGlobal.downloadFiles);
    const dispatch = useDispatch();
    const [fileList, setFileList] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            const { ipcRenderer } = window.require('electron');
            const lists = await ipcRenderer.invoke('getStoreValue', 'downloadFileLists');
            setFileList(lists);
            dispatch(appGlobalActions.updateDownloadedFiles(lists));
        };
        fetchData()
            .catch(console.error);
    }, []);
    function cancelDownload(arr) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('cancelDownload', arr);
        const fetchData = async () => {
            const lists = await ipcRenderer.invoke('getStoreValue', 'downloadFileLists');
            setFileList(lists);
            dispatch(appGlobalActions.updateDownloadedFiles(lists));
        };
        fetchData()
            .catch(console.error);
    }

    return (
        <>
            <Modal
                onClose={onClose}
                title={i18n._('key-DonwloadList/Download Directory')}
            >
                <Modal.Header>
                    {i18n._(
                        'key-DonwloadList/Download Directory'
                    )}
                </Modal.Header>
                <Modal.Body className="width-752">
                    <>
                        {fileList.length > 0 && (fileList.map((list) => {
                            const downloadFile = (find(downloadFiles, ['uuid', list.uuid]));
                            const progress = downloadFile?.progress * 100;
                            const state = downloadFile?.state;
                            const allBytes = Math.floor(downloadFile?.allBytes * 1e-6 * 10) / 10;
                            const receivedBytes = Math.floor(downloadFile?.receivedBytes * 1e-6 * 10) / 10;

                            return (
                                <div
                                    key={list.savedPath}
                                    className={classNames(
                                        'sm-flex',
                                        'padding-vertical-16',
                                        'padding-horizontal-16',
                                        'border-radius-12',
                                        styles['download-item']
                                    )}
                                >
                                    <div className="display-inline padding-right-16">
                                        <img
                                            src="/resources/images/guide-tours/printing-preview.png"
                                            alt=""
                                            className="width-78 sm-flex-width"
                                        />
                                    </div>
                                    <div className="sm-flex-auto display-inline">
                                        <div className="">
                                            <div className="display-inline main-text-outstanding">{list.savedPath}</div>
                                            {state !== 'progressing' && state !== 'paused' && (
                                                <Anchor onClick={() => cancelDownload([list])} className="float-r">
                                                    <SvgIcon
                                                        type={['static']}
                                                        name="Cancel"
                                                        color="#545659"
                                                    />
                                                </Anchor>
                                            )}
                                        </div>
                                        <div className="margin-bottom-8">{list.uuid}</div>
                                        {!(progress >= 0 && progress < 100) && (
                                            <Anchor
                                                className="padding-top-4 display-inline"
                                                onClick={() => openFolder(list.savedPath)}
                                            >
                                                <span
                                                    className="color-blue-2"
                                                    style={{
                                                        textDecoration: 'underline'
                                                    }}
                                                >
                                                    {i18n._('key-app_layout-Open Folder')}
                                                </span>
                                            </Anchor>
                                        )}
                                        {progress >= 0 && progress < 100 && (
                                            <div>
                                                {state !== 'failed' && (
                                                    <div>
                                                        <div className="margin-top-8">{`${receivedBytes} MB`} of {`${allBytes} MB` }</div>
                                                        <div className="margin-top-4 margin-bottom-8">
                                                            <Progress percent={progress} showInfo={false} />
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    {state === 'progressing' && (
                                                        <Button
                                                            className="margin-right-8"
                                                            onClick={() => pauseDownload([list])}
                                                            type="default"
                                                            width="96px"
                                                            priority="level-two"
                                                        >
                                                            {i18n._('key-Modal/Common-Pause')}
                                                        </Button>
                                                    )}
                                                    {(state === 'paused' || state === 'interrupted') && (
                                                        <Button
                                                            onClick={() => resumeDownload([list])}
                                                            className="margin-right-8"
                                                            type="default"
                                                            width="96px"
                                                            priority="level-two"
                                                        >
                                                            {i18n._('key-Modal/Common-Resume')}
                                                        </Button>
                                                    )}
                                                    {state === 'failed' && (
                                                        <Button
                                                            onClick={() => startDownload(list)}
                                                            className="margin-right-8"
                                                            type="default"
                                                            width="96px"
                                                            priority="level-two"
                                                        >
                                                            {i18n._('key-Modal/Common-Resume')}
                                                        </Button>
                                                    )}
                                                    {state !== 'failed' && (
                                                        <Button
                                                            onClick={() => cancelDownload([list])}
                                                            type="default"
                                                            width="96px"
                                                            priority="level-two"
                                                        >
                                                            {i18n._('key-Modal/Common-Cancel')}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            );
                        }))}

                        {fileList.length === 0 && (
                            <div className="margin-auto align-c">
                                <img
                                    src="/resources/images/guide-tours/printing-preview.png"
                                    alt=""
                                    className="width-200"
                                />
                                <div>
                                    {i18n._(
                                        'key-DonwloadList/No downloaded files'
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => cancelDownload(fileList)}
                        className="margin-right-8"
                        type="default"
                        width="96px"
                        priority="level-two"
                    >
                        {i18n._(
                            'key-DonwloadList/Delete All'
                        )}
                    </Button>
                    <Button
                        onClick={onClose}
                        type="default"
                        width="96px"
                        priority="level-two"
                    >
                        {i18n._(
                            'key-DonwloadList/Close'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

DonwloadList.propTypes = {
    onClose: PropTypes.func,
};
export default DonwloadList;
