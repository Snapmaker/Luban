import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, connect, } from 'react-redux';
import { withRouter, useHistory } from 'react-router-dom';
import isElectron from 'is-electron';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import MainToolBar from '../../layouts/MainToolBar';
import { PageMode } from '../PageMode';
import CSDownloadManagerOverlay from '../../views/model-operation-overlay/CSDownloadManagerOverlay';
import { db } from '../../../lib/indexDB/db';

const resourceDomain = 'http://localhost:8085';
// const resourceDomain = 'http://45.79.80.155:8085';
const CaseResource = (props) => {
    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [pageMode, setPageMode] = useState(PageMode.Default);
    const dispatch = useDispatch();
    const history = useHistory();
    const caseResourceIframe = useRef();
    const willMakedProjectFileItemRef = useRef({});
    const willMakedModelFileItemRef = useRef([]);

    // iframe adapt

    function openProject(record) {
        const { downloadUrl, fileName } = willMakedProjectFileItemRef.current;
        const filename = `${record.name}${record.ext}`;
        const isMakeTarget = record.downloadUrl === downloadUrl && filename === fileName;
        console.log('compare', record, downloadUrl, fileName);
        if (isMakeTarget) {
            // reset
            willMakedProjectFileItemRef.current = {};
            willMakedModelFileItemRef.current = [];

            // open project in printing page
            console.log('match', record);
            const { savePath, ext, name, fileNum } = record;
            props.openProject(
                {
                    name: `${name}(${fileNum})${ext}`,
                    path: savePath || '',
                },
                props.history
            );
        }
    }
    function openModel(record) {
        const waitArr = willMakedModelFileItemRef.current;
        console.log('compare arr', record, waitArr);
        const targetIndex = waitArr.findIndex(item => item.downloadUrl === record.downloadUrl && item.fileName === `${record.name}${record.ext}`);
        if (targetIndex !== -1) {
            // reset
            console.log('match, ', targetIndex);
            waitArr.splice(targetIndex, 1);
            willMakedProjectFileItemRef.current = {};

            // open model in printing page
            const { savePath, ext, name, fileNum } = record;
            if (history.location?.pathname === '/printing') {
                history.replace('/');
                console.log(history);
            }
            const goToPrinting = () => history.replace({
                pathname: '/printing',
                state: {
                    initialized: true,
                    needOpenModel: true,
                    fileName: `${name}(${fileNum})${ext}`,
                    savePath
                }
            });
            setTimeout(goToPrinting);
        }
    }
    // iframe adapt
    const mainToolBarId = 'case-resource-main-tool-bar';
    const heightOffset = 8;
    let mainToolBarHeight = 66;
    const handleResize = () => {
        const iframe = caseResourceIframe.current; // document.querySelector('#resource-iframe');
        const mainToolBarEl = document.querySelector(mainToolBarId);
        mainToolBarHeight = (mainToolBarEl && mainToolBarEl.innerHeight) || mainToolBarHeight;
        const windowResize = () => {
            iframe.style.height = `calc(${window.innerHeight}px - ${mainToolBarHeight}px - ${heightOffset}px)`;
        };
        window.addEventListener('resize', windowResize);
        return () => window.removeEventListener('resize', windowResize);
    };
    // get message from iframe
    const handleMessage = () => {
        const msglistener = (event) => {
            if (event.origin === resourceDomain) {
                console.log('get event from iframe:', event);
                setPageMode(PageMode.DownloadManager);
                switch (event.data.type) {
                    case 'make': {
                        console.log('=========', dispatch);
                        const isStl = fileName => fileName.slice(fileName.lastIndexOf('.')) === '.stl';
                        if (!isStl(event.data.fileName)) {
                            willMakedProjectFileItemRef.current = { fileName: event.data.fileName, downloadUrl: event.data.downloadUrl };
                        } else {
                            willMakedModelFileItemRef.current.push({ fileName: event.data.fileName, downloadUrl: event.data.downloadUrl });
                        }
                        console.log('make save:', { fileName: event.data.fileName, downloadUrl: event.data.downloadUrl });
                        break;
                    }
                    case 'download': {
                        console.log('download');
                        break;
                    }
                    default:
                }
            }
        };
        window.addEventListener('message', msglistener);

        const iframe = caseResourceIframe.current;
        iframe.onload = () => {
            iframe.contentWindow.postMessage({
                type: 'isElectron',
                value: true
            }, resourceDomain);
        };
        return () => window.removeEventListener('message', msglistener);
    };
    const handleDownloadFile = () => {
        if (!isElectron()) return;
        const { ipcRenderer } = window.require('electron');
        const newDownloadItem = (e, item) => {
            // add a new record to db
            db.downloadRecords.add(item);
        };
        ipcRenderer.on('new-download-item', newDownloadItem);

        // update progress of download manager
        const updateRecordData = async (item) => {
            const record = await db.downloadRecords.get({ startTime: item.startTime, savePath: item.savePath });
            db.downloadRecords.update(record.id, item);
            return record;
        };
        const downloadItemUpdate = (e, item) => { updateRecordData(item); };
        ipcRenderer.on('download-item-updated', downloadItemUpdate);


        // download done, update data to db
        const downloadItemDone = async (e, downloadItem) => {
            // update db
            setTimeout(() => updateRecordData(downloadItem), 200);

            // handle downloaded file by file's ext
            const record = await db.downloadRecords.get({ startTime: downloadItem.startTime, savePath: downloadItem.savePath });
            if (record.ext === '.snap3dp') {
                openProject(record);
            } else if (record.ext === '.stl') {
                openModel(record);
            }
        };
        ipcRenderer.on('download-item-done', downloadItemDone);

        // eslint-disable-next-line consistent-return
        return () => {
            ipcRenderer.removeListener('new-download-item', newDownloadItem);
            ipcRenderer.removeListener('new-download-item', downloadItemUpdate);
            ipcRenderer.removeListener('new-download-item', downloadItemDone);
        };
    };
    useEffect(() => {
        const resizeOff = handleResize();

        const msgOff = handleMessage();

        const downloadOff = handleDownloadFile();

        return () => {
            resizeOff();
            msgOff();
            downloadOff();
        };
    }, []);

    useEffect(() => {
        console.log(pageMode);
    }, [pageMode]);


    return (
        <>
            <MainToolBar
                wrapID={mainToolBarId}
                leftItems={[
                    {
                        title: 'key-Workspace/Page-Back',
                        name: 'MainToolbarBack',
                        action: () => (props?.isPopup ? props.onClose() : props.history.push('/home')),
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model Simplify'),
                        type: 'button',
                        name: 'MainToolbarDownloadManager',
                        action: async () => {
                            if (pageMode === PageMode.DownloadManager) {
                                // Click again will not exit simplify page mode
                                setPageMode(PageMode.Default);
                            } else {
                                setPageMode(PageMode.DownloadManager);
                            }
                        }
                    },
                ]}
                mainBarClassName="background-transparent"
                lang={i18next.language}
            />
            {/* Change Print Mode */
                pageMode === PageMode.DownloadManager && (
                    <CSDownloadManagerOverlay
                        onClose={() => setPageMode(PageMode.Default)}
                    />
                )
            }
            <iframe
                id="resource-iframe"
                ref={caseResourceIframe}
                style={{
                    width: '100%',
                    height: `calc(${window.innerHeight}px - ${mainToolBarHeight}px - ${heightOffset}px)`,
                }}
                src={`${resourceDomain}/resource-list`}
                frameBorder="0"
                title="case-resource"
            />
        </>
    );
};
CaseResource.propTypes = {
    openProject: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onClose: PropTypes.func,
    isPopup: PropTypes.bool
};

const mapDispatchToProps = (dispatch) => {
    return {
        openProject: (file, history) => dispatch(projectActions.openProject(file, history)),
    };
};
export default withRouter(
    connect(() => {
        return {};
    }, mapDispatchToProps)(CaseResource)
);
