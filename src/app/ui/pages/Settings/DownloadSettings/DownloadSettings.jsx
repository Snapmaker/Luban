import classNames from 'classnames';
import React, { useState, useEffect } from 'react';
// import PropTypes from 'prop-types';
// import { shallowEqual, useSelector } from 'react-redux';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import SvgIcon from '../../../components/SvgIcon';
// import styles from './index.styl';
import UniApi from '../../../../lib/uni-api';


function DownloadSettings() {
    const [historyPath, setHistoryPath] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const { ipcRenderer } = window.require('electron');
            const downloadPath = await ipcRenderer.invoke('getStoreValue', 'downloadPath');
            setHistoryPath(downloadPath);
            console.log('', downloadPath);
        };
        fetchData()
            .catch(console.error);
    }, []);

    async function onChangeDirectory() {
        const files = await UniApi.Dialog.showOpenDirectoryDialog();
        const { ipcRenderer } = window.require('electron');
        const downloadPath = files?.path;
        setHistoryPath(downloadPath);
        ipcRenderer.invoke('updateDownloadPath', downloadPath);
    }
    return (
        <form>
            <div className="">
                <div className="border-bottom-normal padding-bottom-4">
                    <SvgIcon
                        name="TitleSetting"
                        type={['static']}
                    />
                    <span className="margin-left-4">{i18n._('key-App/Settings/Downloads-Download Location')}</span>
                </div>
                <div className="margin-top-16">
                    <span
                        className={classNames(
                            'width-254',
                            'height-32',
                            'text-overflow-ellipsis'
                        )}
                        title={historyPath}
                    >
                        {historyPath}
                    </span>
                    <Button
                        className={classNames(
                            'float-r'
                        )}
                        width="97px"
                        onClick={onChangeDirectory}
                    >
                        {i18n._('key-App/Settings/Downloads-Change Location')}
                    </Button>
                </div>
            </div>
        </form>
    );
}

DownloadSettings.propTypes = {
    // actions: PropTypes.object.isRequired
};

export default DownloadSettings;
