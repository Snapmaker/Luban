import React, { useState, useEffect, useRef } from 'react';
import { connect, shallowEqual, useSelector, useDispatch } from 'react-redux';
import { withRouter, useHistory } from 'react-router-dom';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import isElectron from 'is-electron';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import { actions as appGlobalActions } from '../../../flux/app-global';
import MainToolBar from '../../layouts/MainToolBar';
import { PageMode } from '../PageMode';
import CSDownloadManagerOverlay from '../../views/model-operation-overlay/CSDownloadManagerOverlay';
import { db } from '../../../lib/indexDB/db';
import uniApi from '../../../lib/uni-api';
import { DetailModalState, ModelFileExt, ProjectFileExt, resourcesDomain } from '../../../constants/downloadManager';

const CaseResource = (props) => {
    const dispatch = useDispatch();
    const history = useHistory();

    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [pageMode, setPageMode] = useState(PageMode.Default);
    const [isIframeLoaded, setIsIframeLoaded] = useState(true);
    const caseResourceIframe = useRef();
    const willMakedProjectFileItemRef = useRef({});
    const willMakedModelFileItemRef = useRef([]);
    const caseResourceId = useSelector(state => state?.appGlobal?.caseResourceId, shallowEqual);

    function openProject(record) {
        const { downloadUrl, fileName } = willMakedProjectFileItemRef.current;
        const recordFileName = `${record.name}${record.ext}`;
        const isMakeTarget = decodeURIComponent(record.downloadUrl) === downloadUrl && recordFileName === fileName;
        if (isMakeTarget) {
            // reset
            willMakedProjectFileItemRef.current = {};
            willMakedModelFileItemRef.current = [];

            // open project in printing page
            const { savePath, ext, name, fileNum } = record;
            props.openProject(
                {
                    name: `${name}${fileNum > 0 ? `(${fileNum})` : ''}${ext}`,
                    path: savePath || '',
                },
                props.history
            );
            props.onClose();
        }
    }
    function openModel(record) {
        const waitArr = willMakedModelFileItemRef.current;
        const targetIndex = waitArr.findIndex(item => item.downloadUrl === decodeURIComponent(record.downloadUrl) && item.fileName === `${record.name}${record.ext}`);
        if (targetIndex !== -1) {
            // reset
            waitArr.splice(targetIndex, 1);
            willMakedProjectFileItemRef.current = {};

            // open model in printing page
            const { savePath, ext, name, fileNum } = record;
            if (history.location?.pathname === '/printing') {
                history.replace('/');
            }
            const goToPrinting = () => history.replace({
                pathname: '/printing',
                state: {
                    initialized: true,
                    needOpenModel: true,
                    fileName: `${name}${fileNum > 0 ? `(${fileNum})` : ''}${ext}`,
                    savePath
                }
            });
            props.onClose();
            setTimeout(goToPrinting);
        }
    }

    // iframe adapt
    const mainToolBarId = 'case-resource-main-tool-bar';
    const heightOffset = 8;
    let mainToolBarHeight = 66;
    // test access of iframe src by path /access-test.css.
    // Front end should provid this file in server
    const accessTest = (cb) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `${resourcesDomain}/access-test.css`;
        link.onerror = () => {
            cb();
            setIsIframeLoaded(false);
            document.head.removeChild(link);
        };
        document.head.appendChild(link);
    };
    const handleIframe = () => {
        const iframe = caseResourceIframe.current;
        const timerRef = setTimeout(() => {
            setIsIframeLoaded(false);
        }, 60 * 1000);
        const handleLoaded = () => {
            setIsIframeLoaded(true);
            clearTimeout(timerRef);
        };
        iframe.addEventListener('load', handleLoaded);
        accessTest(() => iframe.removeEventListener('load', handleLoaded));
    };
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

    // get/send message from iframe
    const sendMsgToIframe = (data, iframeEl) => iframeEl && iframeEl.contentWindow.postMessage(data, resourcesDomain);
    const handleMessage = () => {
        const makeFile = (fileName, downloadUrl) => {
            const fileExt = fileName.substr(fileName.lastIndexOf('.') + 1);
            if (fileExt && ModelFileExt[fileExt.toLowerCase()]) {
                willMakedModelFileItemRef.current.push({ fileName, downloadUrl });
            } else if (fileExt && ProjectFileExt[fileExt.toLowerCase()]) {
                willMakedProjectFileItemRef.current = { fileName, downloadUrl };
            }
        };
        const msglistener = (event) => {
            if (event.origin === resourcesDomain) {
                switch (event.data.type) {
                    case 'make': {
                        // download and open .stl/.obj/.3mf/.amf or .snap3dp file in Luban
                        setPageMode(PageMode.DownloadManager);
                        makeFile(event.data.fileName, event.data.downloadUrl);
                        break;
                    }
                    case 'download': {
                        // just download file(no open in Luban)
                        setPageMode(PageMode.DownloadManager);
                        break;
                    }
                    case 'url': {
                        // open url by browser（for Copyright detail website)
                        if (!event.data.url) return;
                        uniApi.DownloadManager.openUrl(event.data.url, '_blank');
                        break;
                    }
                    default:
                }
            }
        };
        window.addEventListener('message', msglistener);

        const iframe = caseResourceIframe.current;
        iframe.onload = () => {
            sendMsgToIframe({
                type: 'isElectron',
                value: true
            }, iframe);
            caseResourceId && sendMsgToIframe({
                type: 'open-detail',
                id: caseResourceId
            });
        };
        return () => window.removeEventListener('message', msglistener);
    };

    // get downloading msg from main process and save in db
    const handleDownloadFile = () => {
        // add a new record to db
        const newDownloadItem = (e, item) => {
            return db.downloadRecords.add(item);
        };
        uniApi.DownloadManager.on('new-download-item', newDownloadItem);

        // update progress of download manager
        const updateRecordData = async (downloadItem) => {
            let record = await db.downloadRecords.get({ startTime: downloadItem.startTime, savePath: downloadItem.savePath });
            if (!record) {
                record = await newDownloadItem(null, downloadItem);
            }
            db.downloadRecords.update(record.id, downloadItem);
            return record;
        };
        const downloadItemUpdate = (e, item) => { updateRecordData(item); };
        uniApi.DownloadManager.on('download-item-updated', downloadItemUpdate);


        // download done, update data to db
        const downloadItemDone = async (e, downloadItem) => {
            if (downloadItem.state === 'cancelled') {
                return;
            }

            // update db
            setTimeout(() => updateRecordData(downloadItem), 200);

            // handle downloaded file by file's ext
            let record = await db.downloadRecords.get({ startTime: downloadItem.startTime, savePath: downloadItem.savePath });
            if (!record) {
                record = await newDownloadItem(null, downloadItem);
            }

            const isModelFile = Object.values(ModelFileExt).some(ext => downloadItem.ext && ext === downloadItem.ext.toLowerCase());
            if (downloadItem.ext && ProjectFileExt.snap3dp === downloadItem.ext.toLowerCase()) {
                openProject(downloadItem);
            } else if (isModelFile) {
                openModel(downloadItem);
            }
        };
        uniApi.DownloadManager.on('download-item-done', downloadItemDone);


        // eslint-disable-next-line consistent-return
        return () => {
            uniApi.DownloadManager.off('new-download-item', newDownloadItem);
            uniApi.DownloadManager.off('new-download-item', downloadItemUpdate);
            uniApi.DownloadManager.off('new-download-item', downloadItemDone);
        };
    };

    // reload iframe when internet is offline
    const reloadIframe = () => {
        const iframe = caseResourceIframe.current;
        const src = iframe.src;
        iframe.src = 'about:blank';
        requestAnimationFrame(() => {
            iframe.src = src;
            handleIframe();
            handleMessage();
        });
    };


    useEffect(() => {
        handleIframe();

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
        const isCaseResourceValid = caseResourceId > 0 || caseResourceId === DetailModalState.Close;
        if (!isElectron() || !isCaseResourceValid) return;
        const iframe = caseResourceIframe.current;
        sendMsgToIframe({
            type: 'open-detail',
            id: caseResourceId
        }, iframe);

        // reset for next time open
        dispatch(appGlobalActions.updateState({ caseResourceId: DetailModalState.Reset }));
    }, [caseResourceId]);


    return (
        <>
            <MainToolBar
                wrapID={mainToolBarId}
                leftItems={[
                    {
                        title: i18n._('key-CaseResource/Page-Back'),
                        name: 'MainToolbarBack',
                        action: () => (props?.isPopup ? props.onClose() : props.history.push('/home')),
                    },
                    {
                        title: i18n._('key-CaseResource/MainToolBar-DownloadManager Download'),
                        type: 'button',
                        name: 'MainToolbarDownloadFolderSetting',
                        action: async (e) => {
                            if (pageMode === PageMode.DownloadManager) {
                                // Click again will not exit simplify page mode
                                setPageMode(PageMode.Default);
                            } else {
                                e.stopPropagation();
                                setPageMode(PageMode.DownloadManager);
                            }
                        }
                    },
                ]}
                mainBarClassName="background-transparent"
                lang={i18next.language}
            />
            {/* Case Resource Download Manager */
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
                    display: isIframeLoaded ? '' : 'none'
                }}
                src={`${resourcesDomain}/resource-list`}
                frameBorder="0"
                title="case-resource"
            />
            {!isIframeLoaded && (
                <div className="position-absolute-center sm-flex">
                    loading page failed! please
                    <span className="color-blue-2" onClick={() => reloadIframe()} onKeyPress={() => reloadIframe()} tabIndex="0" role="button">
                        &nbsp;reload
                    </span>.
                </div>
            )}
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
