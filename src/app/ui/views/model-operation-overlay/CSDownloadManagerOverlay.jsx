import classNames from 'classnames';
import PropTypes from 'prop-types';
import { withRouter, useHistory } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';

import { connect, shallowEqual, useSelector } from 'react-redux';
import { Progress } from 'antd';
import { actions as projectActions } from '../../../flux/project';
import { actions as appGlobalActions } from '../../../flux/app-global';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import styles from './styles.styl';
import SvgIcon from '../../components/SvgIcon';
import { db } from '../../../lib/indexDB/db';
import { KB, MB, RecordState } from '../../../constants/downloadManager';
import uniApi from '../../../lib/uni-api';


/**
 * Overlay that can be used to change print mode.
 */
const CSDownloadManagerOverlay = (props) => {
    const history = useHistory();
    const downloadManangerSavedPath = useSelector(state => state?.appGlobal?.downloadManangerSavedPath, shallowEqual);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [records, setRecords] = useState([]);
    const recordsRef = useRef(records);
    const nextPage = () => setPage(page + 1);
    const prePage = () => setPage(page - 1);
    const changePageSize = size => setPageSize(size);
    const isCompleted = (record) => record.state === RecordState.Completed || record.totalBytes === record.receivedBytes;
    const updateDataFromDB = async () => {
        const dbRescords = await db.downloadRecords.orderBy('startTime').reverse().limit(pageSize).offset(page * pageSize)
            .toArray();
        setRecords(dbRescords);
        recordsRef.current = dbRescords;
    };
    async function onClear() {
        // remove db
        db.downloadRecords.clear();
        // uniApi.DownloadManager.emit('clear-files', paths);
    }
    function onClose() {
        console.log(props.onClose);
        props.onClose && props.onClose();
    }
    function onOpenFile(path) {
        uniApi.DownloadManager.openFloder(path);
    }
    function onOpenFloder() {
        uniApi.DownloadManager.openFloder(downloadManangerSavedPath);
    }
    function onRemove(record) {
        // remove local file
        uniApi.DownloadManager.removeFile(record.savePath);

        // remove file msg in ui
        const recordsRefValue = recordsRef.current;
        const newRecords = recordsRefValue.filter(r => r.startTime !== record.startTime || r.savePath !== record.savePath);
        setRecords(newRecords);
        recordsRef.current = newRecords;

        // remove file msg in local db
        db.downloadRecords.get({ startTime: record.startTime, savePath: record.savePath })
            .then(r => db.downloadRecords.delete(r.id))
            .catch(err => console.error(err));
    }
    function sizeFormat(bytes) {
        const unit = 'MB';
        return `${(bytes / MB).toFixed(2)} ${unit}`;
    }
    function timeFormat(time) {
        time = Math.ceil(time);
        const second = 1;
        const minute = 60 * second;
        const hour = 60 * minute;
        const timeHour = Math.floor(time / hour);
        const timeMinute = Math.floor((time % hour) / minute);
        const timeSecond = (time - timeHour * hour - timeMinute * minute) / second;
        if (timeHour > 0) {
            return `${timeHour}h${timeMinute}m${timeSecond}s`;
        } else if (timeMinute > 0) {
            return `${timeMinute}m${timeSecond}s`;
        } else {
            return `${timeSecond}s`;
        }
    }
    function calcDownloadSpeed(record) {
        if (!record.lastUpdateTime) {
            record.lastUpdateTime = record.startTime;
            record.speed = '0 B/s';
            return;
        }
        if (!record.lastReceivedBytes) {
            record.lastReceivedBytes = record.receivedBytes;
            record.speed = '0 B/s';
            return;
        }
        const current = Date.now() / 1000;
        const during = current - record.lastUpdateTime;
        let speed = (record.receivedBytes - record.lastReceivedBytes) / during;
        record.remainTime = speed === 0 ? record.remainTime : timeFormat((record.totalBytes - record.receivedBytes) / speed);

        // format speed
        let unit = 'Byte';
        if (speed === 0) {
            return;
        } else if (speed > MB) {
            speed /= MB;
            unit = 'MB';
        } else if (speed > KB) {
            speed /= KB;
            unit = 'KB';
        }
        record.speed = `${speed.toFixed(2)} ${unit}/s`;
        record.lastUpdateTime = current;
        record.lastReceivedBytes = record.receivedBytes;
    }
    function onOpenProject({ savePath, ext, name, fileNum }) {
        props.toggleCaseResource(false);
        props.openProject(
            {
                name: `${name}(${fileNum})${ext}`,
                path: savePath || '',
            },
            props.history
        );
    }
    function onOpenModel({ savePath, ext, name, fileNum }) {
        if (history.location?.pathname === '/printing') {
            history.replace('/');
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
        props.toggleCaseResource(false);
        setTimeout(goToPrinting);
    }

    function renderDownloading(record) {
        return (
            <div className="">
                {record.speed}-{sizeFormat(record.receivedBytes)} of {sizeFormat(record.totalBytes)}  {record.remainTime}
            </div>
        );
    }
    function renderDownloadDone(record) {
        switch (record.ext) {
            case '.snap3dp': {
                return (
                    <div
                        className="font-size-small color-blue-2"
                        onClick={() => onOpenProject(record)}
                        role="button"
                        onKeyDown={() => onOpenProject(record)}
                        tabIndex={0}
                    >
                        {i18n._('key-CaseResource/DownloadManager Open')}
                    </div>
                );
            }
            case '.stl': {
                return (
                    <div
                        className="font-size-small color-blue-2"
                        onClick={() => onOpenModel(record)}
                        role="button"
                        onKeyDown={() => onOpenModel(record)}
                        tabIndex={0}
                    >
                        {i18n._('key-CaseResource/DownloadManager Import to Luban')}
                    </div>
                );
            }
            default: {
                return (
                    <div
                        className="font-size-small color-blue-2"
                        onClick={() => onOpenFile(record.savePath)}
                        role="button"
                        onKeyDown={() => onOpenFile(record.savePath)}
                        tabIndex={0}
                    >
                        {i18n._('key-CaseResource/DownloadManager Open File Exploxer')}
                    </div>
                );
            }
        }
    }
    function renderDownloadError() {
        return <div>{i18n._('key-CaseResource/DownloadManager Error')}</div>;
    }
    function renderRecord(record) {
        if (!record) return '';
        if (record.state === RecordState.Progressing && record.speed) return renderDownloading(record);
        if (isCompleted(record)) return renderDownloadDone(record);
        if (record.state === RecordState.Interrupted) return renderDownloadError(record);
        return '';
    }
    useEffect(() => {
        console.log('open download manager');
        console.log(nextPage, prePage, changePageSize);
        updateDataFromDB();

        // start download item for ui
        const newDownloadItemUI = (e, downloadItem) => {
            // add a new item for ui(no from db)
            const newRecords = [downloadItem, ...recordsRef.current];
            setRecords(newRecords);
            recordsRef.current = newRecords;
        };
        uniApi.DownloadManager.on('new-download-item', newDownloadItemUI);

        // update record data for ui
        const updateDataForUI = downloadItem => {
            const recordsRefValue = recordsRef.current;
            const updateRecords = recordsRefValue.map(oldRecord => {
                if (oldRecord.startTime === downloadItem.startTime && oldRecord.savePath === downloadItem.savePath) {
                    const newRecords = Object.assign({}, oldRecord, downloadItem);
                    calcDownloadSpeed(newRecords);
                    return newRecords;
                } else {
                    return oldRecord;
                }
            });
            setRecords(updateRecords);
            recordsRef.current = updateRecords;
        };
        const updateDownloadItem = (e, downloadItem) => updateDataForUI(downloadItem);
        uniApi.DownloadManager.on('download-item-updated', updateDownloadItem);
        uniApi.DownloadManager.on('download-item-done', updateDownloadItem);

        // eslint-disable-next-line consistent-return
        return () => {
            uniApi.DownloadManager.off('new-download-item', newDownloadItemUI);
            uniApi.DownloadManager.off('download-item-updated', updateDownloadItem);
            uniApi.DownloadManager.off('download-item-done', updateDownloadItem);
        };
    }, []);

    return (
        <div className="position-absolute width-438 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16')}>
                {i18n._('key-CaseResource/DownloadManager Download')}
            </div>
            <div style={{ maxHeight: '60vh', flexFlow: 'column', overflow: 'auto' }} className="sm-flex sm-flex-direction-c justify-space-between padding-vertical-16 padding-horizontal-16">
                {
                    records.map(record => (
                        <div style={{ flex: '0 0 auto' }} className="sm-flex align-center padding-bottom-16 record-item" key={record.startTime} title={record.savePath}>
                            <div style={{ width: '100%', lineHeight: 1 }}>
                                <div className="font-size-base color-black-3">{`${record.name}(${record.fileNum})${record.ext}`}</div>
                                {record.state === RecordState.Progressing && (
                                    <Progress
                                        style={{ lineHeight: 1 }}
                                        showInfo={false}
                                        percent={isCompleted(record) ? 100 : record.receivedBytes / record.totalBytes * 100}
                                        trailColor="#D9D9D9"
                                        strokeColor="#1890FF"
                                    />
                                )}
                                <div className="sm-flex" style={{ color: '#979797', fontSize: '10px' }}>
                                    {renderRecord(record)}
                                </div>
                            </div>
                            <SvgIcon
                                name="Delete"
                                size={24}
                                title={i18n._('key-Workspace/Transport-Delete')}
                                // disabled={!selectedFile}
                                onClick={() => onRemove(record)}
                            />
                        </div>
                    ))
                }
            </div>
            <div
                className={classNames(
                    'padding-horizontal-16 padding-vertical-8 border-radius-bottom-8',
                    'sm-flex justify-flex-end',
                    'background-grey-3',
                )}
            >
                <Button
                    onClick={onClear}
                    priority="level-two"
                    width="96px"
                    type="default"
                    title="will not clear local files"
                >
                    {i18n._('key-CaseResource/DownloadManager Clear')}
                </Button>
                <Button
                    onClick={onClose}
                    priority="level-two"
                    width="96px"
                    type="default"
                >

                    {i18n._('key-CaseResource/DownloadManager Close')}
                </Button>
                <Button
                    onClick={onOpenFloder}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-CaseResource/DownloadManager Open Folder')}
                </Button>
            </div>
        </div>
    );
};

CSDownloadManagerOverlay.propTypes = {
    openProject: PropTypes.func.isRequired,
    toggleCaseResource: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onClose: PropTypes.func,
};

const mapDispatchToProps = (dispatch) => {
    return {
        openProject: (file, history) => dispatch(projectActions.openProject(file, history)),
        toggleCaseResource: (showCaseResource) => dispatch(appGlobalActions.updateState({ showCaseResource })),
    };
};

export default withRouter(connect(() => {
    return {};
}, mapDispatchToProps)(CSDownloadManagerOverlay));
