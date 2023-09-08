// import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
// import FacebookLoading from 'react-facebook-loading';
// import { connect } from 'react-redux';
// import settings from '../../../../config/settings';
import isElectron from 'is-electron';
import { connect } from 'react-redux';
import { actions as appGlobalActions } from '../../../../../flux/app-global';
import i18n from '../../../../../lib/i18n';
import SvgIcon from '../../../../components/SvgIcon';
import { TextInput } from '../../../../components/Input';
import UniApi from '../../../../../lib/uni-api';
import downloadManager from '../../../../../lib/download-mananger';

function Download(props) {
    const [selectedFolder, setSelectedFolder] = useState(props.downloadManangerSavedPath);

    const actions = {
        onSave: () => {
            props.updateDownloadManangerSavedPath(selectedFolder);
        },
        onCancel: () => {
        }
    };
    const savePath = path => {
        setSelectedFolder(path);
    };
    const handleFolderChange = (folder) => {
        savePath(folder);
    };
    const onClickToUpload = () => {
        if (!isElectron()) return;
        downloadManager.emit('select-directory');
        downloadManager.on('selected-directory', (event, data) => {
            const { canceled, filePaths } = JSON.parse(data);
            if (canceled) return;
            savePath(filePaths[0]);
        });
    };

    useEffect(() => {
        function cleanup() {
            UniApi.Event.off('appbar-menu:settings.save', actions.onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', actions.onCancel);
        }

        cleanup();
        UniApi.Event.on('appbar-menu:settings.save', actions.onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', actions.onCancel);
        return cleanup;
    }, [actions.onSave, actions.onCancel]);


    return (
        <div>
            <form>
                <div>
                    <div className="border-bottom-normal padding-bottom-4">
                        <SvgIcon
                            name="TitleSetting"
                            type={['static']}
                        />
                        <span className="margin-left-4">{i18n._('key-App/Settings/Settings-Download')}</span>
                    </div>
                    <div className="margin-top-16">
                        <div className="padding-bottom-4">
                            <TextInput onClick={() => onClickToUpload()} disabled size="250px" value={selectedFolder} onChange={handleFolderChange} />
                            <SvgIcon
                                type={['hoverSpecial', 'pressSpecial']}
                                name="ToolbarOpen"
                                className="padding-horizontal-4 print-tool-bar-open margin-left-12"
                                onClick={() => onClickToUpload()}
                                size={31}
                                color="#545659"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

Download.propTypes = {
    downloadManangerSavedPath: PropTypes.string.isRequired,
    // actions: PropTypes.object.isRequired,
    updateDownloadManangerSavedPath: PropTypes.func.isRequired
};


const mapStateToProps = (state) => {
    const { downloadManangerSavedPath } = state.appGlobal;
    return {
        downloadManangerSavedPath
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDownloadManangerSavedPath: path => dispatch(appGlobalActions.updateDownloadManangerSavedPath(path))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Download);
