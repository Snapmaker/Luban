import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

import classNames from 'classnames';
import { connect } from 'react-redux';
import _ from 'lodash';
import path from 'path';
import request from 'superagent';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
// import widgetStyles from '../styles.styl';
import styles from './index.styl';
import {
    CONNECTION_TYPE_WIFI,
    DATA_PREFIX,
    // IMAGE_WIFI_CONNECTED,
    // IMAGE_WIFI_ERROR,
    MACHINE_HEAD_TYPE
} from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';

import modalSmallHOC from '../../components/Modal/modal-small';
import { Button } from '../../components/Buttons';
// import SvgIcon from '../../components/SvgIcon';
import Checkbox from '../../components/Checkbox';


// import controller from '../../lib/controller';


class WifiTransport extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,

        gcodeFiles: PropTypes.array.isRequired,

        headType: PropTypes.string,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,

        renameGcodeFile: PropTypes.func.isRequired,
        removeGcodeFile: PropTypes.func.isRequired,
        exportFile: PropTypes.func.isRequired,

        uploadGcodeFile: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired,
        uploadGcodeFileToList: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    changeNameInput = [];


    state = {
        loadToWorkspaceOnLoad: true,
        selectFileName: '',
        selectFileType: ''
    };


    actions = {
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            const { loadToWorkspaceOnLoad } = this.state;

            if (loadToWorkspaceOnLoad) {
                this.props.uploadGcodeFile(file);
            } else {
                this.props.uploadGcodeFileToList(file);
            }
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onExport: () => {
            if (!this.state.selectFileName) {
                return;
            }
            this.props.exportFile(this.state.selectFileName);
        },
        onChangeShouldPreview: () => {
            this.setState(state => ({
                loadToWorkspaceOnLoad: !state.loadToWorkspaceOnLoad
            }));
        },

        loadGcodeToWorkspace: () => {
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            this.props.renderGcodeFile(find);
        },

        // File item operations
        onRenameStart: (uploadName, index, event) => {
            this.props.renameGcodeFile(uploadName, null, true);
            event.stopPropagation();
            setTimeout(() => {
                this.changeNameInput[index].current.focus();
            }, 0);
        },
        onRenameEnd: (uploadName, index) => {
            let newName = this.changeNameInput[index].current.value;
            const m = uploadName.match(/(.gcode|.cnc|.nc)$/);
            if (m) {
                newName += m[0];
            }
            this.props.renameGcodeFile(uploadName, newName, false);
        },
        onKeyDown: (e) => {
            let keynum;
            if (window.event) {
                keynum = e.keyCode;
            } else if (e.which) {
                keynum = e.which;
            }
            if (keynum === 13) {
                e.target.blur();
            }
        },
        onSelectFile: (selectFileName, name, event) => {
            if (event && (event.target.className.indexOf('input-select') > -1 || event.target.className.indexOf('fa-check') > -1)) {
                return;
            }
            // this.props.renameGcodeFile(selectFileName, name, false, true);
            const filename = path.basename(selectFileName);
            let type = '';
            if (filename.endsWith('.gcode')) {
                type = MACHINE_HEAD_TYPE['3DP'].value;
            }
            if (filename.endsWith('.nc')) {
                type = MACHINE_HEAD_TYPE.LASER.value;
            }
            if (filename.endsWith('.cnc')) {
                type = MACHINE_HEAD_TYPE.CNC.value;
            }
            if (this.state.selectFileName === selectFileName) {
                this.setState({
                    selectFileName: '',
                    selectFileType: type
                });
            } else {
                this.setState({
                    selectFileName: selectFileName,
                    selectFileType: type
                });
            }
        },
        onRemoveFile: (gcodeFile) => {
            this.props.removeGcodeFile(gcodeFile);
        },

        // Wi-Fi transfer file to Snapmaker
        sendFile: () => {
            const isSendingFile = modalSmallHOC({
                title: i18n._('Sending File'),
                text: i18n._('Sending file. Please wait…'),
                iconColor: '#4CB518',
                img: 'WarningTipsProgress'
            }).ref;
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            request.get(gcodePath).end((err1, res) => {
                const gcode = res.text;
                const blob = new Blob([gcode], { type: 'text/plain' });
                const file = new File([blob], find.name);
                this.props.server.uploadFile(find.name, file, (err, data, text) => {
                    isSendingFile.current.removeContainer();
                    if (err) {
                        modalSmallHOC({
                            title: i18n._('Failed to Send File'),
                            text: text,
                            iconColor: '#FF4D4F',
                            img: 'WarningTipsError'
                        });
                    } else {
                        (modalSmallHOC({
                            title: i18n._('File Sent Successfully'),
                            text: i18n._('Your file was successfully sent. Receive it on the Touchscreen.'),
                            iconColor: '#4CB518',
                            img: 'WarningTipsSuccess'
                        }));
                    }
                });
            });
        },
        importFile: (fileObj) => {
            if (fileObj) {
                this.actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                this.actions.onClickToUpload();
            }
        }
    };


    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('G-code Files'));
    }

    componentDidMount() {
        for (let i = 0; i < 5; i++) {
            this.changeNameInput[i] = React.createRef();
        }
        UniApi.Event.on('appbar-menu:workspace.export-gcode', this.actions.onExport);
        UniApi.Event.on('appbar-menu:workspace.import', this.actions.importFile);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.gcodeFiles.length > 0
            && (nextProps.gcodeFiles.length !== this.props.gcodeFiles.length || nextProps.gcodeFiles[0].uploadName !== this.props.gcodeFiles[0].uploadName)) {
            this.actions.onSelectFile(nextProps.gcodeFiles[0].uploadName);
        }
    }

    componentWillUnmount() {
        for (let i = 0; i < 5; i++) {
            this.changeNameInput[i] = null;
        }
        UniApi.Event.off('appbar-menu:workspace.export-gcode', this.actions.onExport);
        UniApi.Event.off('appbar-menu:workspace.import', this.actions.importFile);
    }

    render() {
        const { gcodeFiles, isConnected, headType, connectionType } = this.props;
        const { loadToWorkspaceOnLoad, selectFileName, selectFileType } = this.state;
        const isHeadType = selectFileType === headType;
        const actions = this.actions;
        const hasFile = gcodeFiles.length > 0;

        return (
            <div>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".gcode,.nc,.cnc"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <Button
                    width="160px"
                    type="primary"
                    className="margin-bottom-8 display-inline"
                    priority="level-three"
                    onClick={actions.onClickToUpload}
                >
                    {i18n._('Open G-code')}
                </Button>
                <Button
                    width="160px"
                    type="primary"
                    className="margin-bottom-8 display-inline margin-left-8"
                    priority="level-three"
                    onClick={actions.onExport}
                >
                    {i18n._('Export G-code')}
                </Button>
                <div className="margin-bottom-8">
                    <Checkbox
                        checked={loadToWorkspaceOnLoad}
                        onChange={actions.onChangeShouldPreview}
                    />
                    <span className="margin-left-8">{i18n._('Preview in workspace')}</span>
                </div>
                {_.map(gcodeFiles, (gcodeFile, index) => {
                    const name = gcodeFile.name.length > 25
                        ? `${gcodeFile.name.substring(0, 15)}...${gcodeFile.name.substring(gcodeFile.name.length - 10, gcodeFile.name.length)}`
                        : gcodeFile.name;
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
                    const selected = selectFileName === gcodeFile.uploadName;
                    return (
                        <div
                            className={classNames(
                                styles['gcode-file'],
                                { [styles.selected]: selected }
                            )}
                            key={pathWithRandomSuffix(gcodeFile.uploadName)}
                            onClick={
                                (event) => actions.onSelectFile(gcodeFile.uploadName, name, event)
                            }
                            onKeyDown={noop}
                            role="button"
                            tabIndex={0}
                        >
                            <button
                                type="button"
                                className={styles['gcode-file-remove']}
                                onClick={() => {
                                    actions.onRemoveFile(gcodeFile);
                                }}
                            />
                            {selected && <div className={styles['gcode-file-selected-icon']} />}
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
                                    onClick={(event) => actions.onRenameStart(uploadName, index, event)}
                                >
                                    <div
                                        className={styles['gcode-file-text-rename']}
                                    >
                                        {name}
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
                                        onBlur={() => actions.onRenameEnd(uploadName, index)}
                                        onKeyDown={(event) => actions.onKeyDown(event)}
                                        ref={this.changeNameInput[index]}
                                    />
                                </div>
                                <div className={styles['gcode-file-text-info']}>
                                    <span>{size}</span>
                                    <span>{date}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <Button
                    type="primary"
                    className="margin-vertical-8"
                    priority="level-two"
                    disabled={!hasFile}
                    onClick={actions.loadGcodeToWorkspace}
                >
                    {i18n._('Load G-code to Workspace')}
                </Button>
                <Button
                    type="primary"
                    className="margin-bottom-16"
                    priority="level-two"
                    disabled={!(hasFile && isConnected && isHeadType && connectionType === CONNECTION_TYPE_WIFI)}
                    onClick={actions.sendFile}
                >
                    {i18n._('Send to Device via Wi-Fi')}
                </Button>
            </div>
        );
    }
}


const mapStateToProps = (state) => {
    const { gcodeFiles } = state.workspace;
    const { server, isConnected, headType, connectionType } = state.machine;

    return {
        gcodeFiles,
        headType,
        isConnected,
        connectionType,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        renameGcodeFile: (uploadName, newName, isRenaming) => dispatch(workspaceActions.renameGcodeFile(uploadName, newName, isRenaming)),
        uploadGcodeFile: (fileInfo) => dispatch(workspaceActions.uploadGcodeFile(fileInfo)),
        removeGcodeFile: (fileInfo) => dispatch(workspaceActions.removeGcodeFile(fileInfo)),
        renderGcodeFile: (file) => dispatch(workspaceActions.renderGcodeFile(file, false)),
        exportFile: (targetFile) => dispatch(projectActions.exportFile(targetFile)),
        uploadGcodeFileToList: (fileInfo) => dispatch(workspaceActions.uploadGcodeFileToList(fileInfo))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WifiTransport);
