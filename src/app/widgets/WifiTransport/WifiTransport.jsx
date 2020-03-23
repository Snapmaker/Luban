import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';
import { connect } from 'react-redux';
import _ from 'lodash';
import jQuery from 'jquery';
import path from 'path';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
// import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import { CONNECTION_TYPE_WIFI, DATA_PREFIX, IMAGE_WIFI_CONNECTED, IMAGE_WIFI_CONNECT_WAITING, IMAGE_WIFI_ERROR, MACHINE_HEAD_TYPE } from '../../constants';
import { actions as workspaceActions } from '../../flux/workspace';
import modalSmallHOC from '../../components/Modal/modal-small';


// import controller from '../../lib/controller';


class WifiTransport extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        gcodeFiles: PropTypes.array.isRequired,

        headType: PropTypes.string,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,

        clearGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        renameGcodeFile: PropTypes.func.isRequired,
        removeGcodeFile: PropTypes.func.isRequired,

        uploadGcodeFile: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    changeNameInput = [];


    state = {
        selectFileName: '',
        selectFileType: ''
    };


    actions = {
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            this.props.uploadGcodeFile(file);
        },
        onRemoveFile: async (gcodeFile) => {
            this.props.removeGcodeFile(gcodeFile);
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        sendFile: () => {
            const isSendingFile = modalSmallHOC({
                title: i18n._('Sending File'),
                text: i18n._('Please wait for the file transform.'),
                img: IMAGE_WIFI_CONNECT_WAITING
            }).ref;
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            jQuery.get(gcodePath, (result) => {
                const blob = new Blob([result], { type: 'text/plain' });
                const file = new File([blob], find.name);
                this.props.server.uploadFile(find.name, file, (err, data, text) => {
                    isSendingFile.current.removeContainer();
                    if (err) {
                        modalSmallHOC({
                            title: i18n._('Failed to Send File'),
                            text: text,
                            img: IMAGE_WIFI_ERROR
                        });
                    } else {
                        (modalSmallHOC({
                            title: i18n._('Send File Successfully'),
                            text: i18n._('Please confirm and choose whether to start print this file on the touchscreen.'),
                            img: IMAGE_WIFI_CONNECTED
                        }));
                    }
                });
            });
        },
        loadGcodeToWorkspace: () => {
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            jQuery.get(gcodePath, (result) => {
                this.props.clearGcode();
                this.props.addGcode(find.name, result);
            });
        },
        onRenameDefinitionStart: (selectFileName, uploadName, index, event) => {
            const basename = selectFileName.replace(/(.gcode|.cnc|.nc)$/, '');
            this.props.renameGcodeFile(uploadName, basename, true);
            event.stopPropagation();
            setTimeout(() => {
                this.changeNameInput[index].current.focus();
            }, 0);
        },
        onRenameDefinitionEnd: (uploadName, index) => {
            const newName = this.changeNameInput[index].current.value;
            this.props.renameGcodeFile(uploadName, newName, false, true);
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
        }

    };


    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Send Files via Wi-Fi'));
    }

    componentDidMount() {
        for (let i = 0; i < 5; i++) {
            this.changeNameInput[i] = React.createRef();
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.gcodeFiles.length > 0 && (nextProps.gcodeFiles.length !== this.props.gcodeFiles.length || nextProps.gcodeFiles[0].uploadName !== this.props.gcodeFiles[0].uploadName)) {
            this.actions.onSelectFile(nextProps.gcodeFiles[0].uploadName);
        }
    }

    componentWillUnmount() {
        for (let i = 0; i < 5; i++) {
            this.changeNameInput[i] = null;
        }
    }

    render() {
        const { gcodeFiles, isConnected, headType, connectionType } = this.props;
        const { selectFileName, selectFileType } = this.state;
        const isHeadType = selectFileType === headType;
        const actions = this.actions;
        const hasFile = gcodeFiles.length > 0;
        return (
            <div>
                <div>
                    {_.map(gcodeFiles, (gcodeFile, index) => {
                        const name = gcodeFile.name.length > 33
                            ? `${gcodeFile.name.substring(0, 15)}......${gcodeFile.name.substring(gcodeFile.name.length - 10, gcodeFile.name.length)}`
                            : gcodeFile.name;
                        let size = '';
                        const { isRenaming, uploadName } = gcodeFile;

                        if (gcodeFile.size / 1024 / 1024 > 1) {
                            size = `${(gcodeFile.size / 1024 / 1024).toFixed(2)} MB`;
                        } else if (gcodeFile.size / 1024 > 1) {
                            size = `${(gcodeFile.size / 1024).toFixed(2)} KB`;
                        } else {
                            size = `${(gcodeFile.size).toFixed(2)} B`;
                        }
                        const lastModifiedDate = gcodeFile.lastModifiedDate;
                        const date = `${lastModifiedDate.getFullYear()}.${lastModifiedDate.getMonth()}.${lastModifiedDate.getDay()}   ${lastModifiedDate.getHours()}:${lastModifiedDate.getMinutes()}`;
                        return (
                            <div
                                key={pathWithRandomSuffix(gcodeFile.uploadName)}
                            >
                                <div
                                    className={classNames(
                                        styles['gcode-file'],
                                        { [styles.selected]: selectFileName === gcodeFile.uploadName }
                                    )}
                                    onClick={
                                        (event) => actions.onSelectFile(gcodeFile.uploadName, name, event)
                                    }
                                    role="button"
                                    onKeyDown={() => {
                                    }}
                                    tabIndex={0}

                                >

                                    <button
                                        type="button"
                                        className={styles['gcode-file-remove']}
                                        onClick={() => {
                                            actions.onRemoveFile(gcodeFile);
                                        }}
                                    />
                                    <div className={styles['gcode-file-img']}>
                                        <img
                                            src={gcodeFile.img}
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
                                            onClick={(event) => actions.onRenameDefinitionStart(gcodeFile.name, uploadName, index, event)}
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
                                                onBlur={() => actions.onRenameDefinitionEnd(uploadName, index)}
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
                            </div>
                        );
                    })}
                    <div>
                        <input
                            ref={this.fileInput}
                            type="file"
                            accept=".gcode,.nc,.cnc"
                            style={{ display: 'none' }}
                            multiple={false}
                            onChange={actions.onChangeFile}
                        />
                        <button
                            type="button"
                            className={classNames(styles['gcode-file'], styles['gcode-file-upload'])}
                            onClick={actions.onClickToUpload}
                        >
                            <i className={classNames(styles['icon-24'], styles['icon-plus'])} />
                            {i18n._('Upload File')}
                        </button>
                    </div>
                </div>
                <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                <button
                    type="button"
                    className="sm-btn-small sm-btn-default"
                    disabled={!hasFile}
                    onClick={actions.loadGcodeToWorkspace}
                    style={{ display: 'block', width: '100%', marginBottom: '10px' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className="sm-btn-small sm-btn-default"
                    disabled={!(hasFile && isConnected && isHeadType && connectionType === CONNECTION_TYPE_WIFI)}
                    onClick={actions.sendFile}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Send via Wi-Fi')}
                </button>

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
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        renameGcodeFile: (uploadName, newName, isRenaming, isChangingName) => dispatch(workspaceActions.renameGcodeFile(uploadName, newName, isRenaming, isChangingName)),
        uploadGcodeFile: (fileInfo) => dispatch(workspaceActions.uploadGcodeFile(fileInfo)),
        removeGcodeFile: (fileInfo) => dispatch(workspaceActions.removeGcodeFile(fileInfo))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WifiTransport);
