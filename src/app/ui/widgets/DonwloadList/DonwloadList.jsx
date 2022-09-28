import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
// import classNames from 'classnames';
import { noop, find } from 'lodash';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
import { actions as appGlobalActions } from '../../../flux/app-global';
import i18n from '../../../lib/i18n';
// import UniApi from '../../../lib/uni-api';

function openFolder(savedModalFilePath) {
    const path = window.require('path');
    console.log('this.props.savedModalFilePath', savedModalFilePath);
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

function DonwloadList({ onClose = noop }) {
    const downloadFiles = useSelector(state => state.appGlobal.downloadFiles);
    const dispatch = useDispatch();
    const [fileList, setFileList] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            const { ipcRenderer } = window.require('electron');
            const lists = await ipcRenderer.invoke('getStoreValue', 'downloadFileLists');
            console.log('', lists);
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
            console.log('', lists);
            setFileList(lists);
            dispatch(appGlobalActions.updateDownloadedFiles(lists));
        };
        fetchData()
            .catch(console.error);
    }

    return (
        <>
            <Modal onClose={onClose} title={i18n._('key-DonwloadList/Download Directory')}>
                <Modal.Header>
                    {i18n._(
                        'key-DonwloadList/Download Directory'
                    )}
                </Modal.Header>
                <Modal.Body>
                    {fileList.map((list) => {
                        const downloadFile = (find(downloadFiles, ['uuid', list.uuid]));
                        const progress = downloadFile?.progress;
                        const allBytes = Math.floor(downloadFile?.allBytes * 1e-6 * 10) / 10;
                        const receivedBytes = Math.floor(downloadFile?.receivedBytes * 1e-6 * 10) / 10;

                        return (
                            <div key={list.savedPath} className="sm-flex">
                                <div className="display-inline">
                                    <img
                                        src="/resources/images/guide-tours/printing-preview.png"
                                        alt=""
                                        className="width-80 sm-flex-width"
                                    />
                                </div>
                                <div className="sm-flex-auto display-inline">
                                    <div>
                                        <p className="display-inline">{list.savedPath}</p>
                                        <Anchor onClick={() => cancelDownload([list])} className="float-r">
                                            <SvgIcon
                                                type={['static']}
                                                name="Cancel"
                                            />
                                        </Anchor>
                                    </div>
                                    <p>{list.uuid}</p>
                                    <Anchor
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
                                    {progress >= 0 && progress < 1 && (
                                        <div>
                                            <p>{`${receivedBytes} MB`} of {`${allBytes} MB` }</p>
                                            <p>{progress}</p>
                                            <p>
                                                <Button onClick={() => pauseDownload([list])}>
                                                    {i18n._('key-Modal/Common-Pause')}
                                                </Button>
                                                <Button onClick={() => resumeDownload([list])}>
                                                    {i18n._('key-Modal/Common-Resume')}
                                                </Button>
                                                <Button onClick={() => cancelDownload([list])}>
                                                    {i18n._('key-Modal/Common-Cancel')}
                                                </Button>
                                            </p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        );
                    })}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => cancelDownload(fileList)}
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
