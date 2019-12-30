import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';
import { connect } from 'react-redux';
import _ from 'lodash';
import jQuery from 'jquery';
import path from 'path';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import { DATA_PREFIX, IMAGE_WIFI_CONNECTED, IMAGE_WIFI_ERROR, MACHINE_HEAD_TYPE } from '../../constants';
import { actions as workspaceActions } from '../../flux/workspace';
import modalSmallHOC from '../../components/Modal/modal-small';


// import controller from '../../lib/controller';


class WifiTransport extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        gcodeFiles: PropTypes.array.isRequired,
        headType: PropTypes.string,
        isConnected: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,

        clearGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        uploadGcodeFile: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        selectFileName: '',
        selectFileType: ''
    };

    actions = {
        onSelectFile: (selectFileName) => {
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
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            this.props.uploadGcodeFile(file);
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        sendFile: () => {
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            jQuery.get(gcodePath, (result) => {
                const blob = new Blob([result], { type: 'text/plain' });
                const file = new File([blob], find.uploadName);
                this.props.server.uploadFile(find.uploadName, file, (err, data, text) => {
                    if (err) {
                        modalSmallHOC({
                            title: i18n._('Send File Error'),
                            text: text,
                            img: IMAGE_WIFI_ERROR
                        });
                    } else {
                        modalSmallHOC({
                            title: i18n._('Send File Success'),
                            text: i18n._('Please go to the screen to confirm whether to start print.'),
                            img: IMAGE_WIFI_CONNECTED
                        });
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
                this.props.addGcode(selectFileName, result);
            });
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Wi-Fi Transport'));
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.gcodeFiles.length > 0 && nextProps.gcodeFiles.length !== this.props.gcodeFiles.length) {
            this.actions.onSelectFile(nextProps.gcodeFiles[0].uploadName);
        }
    }

    render() {
        const { gcodeFiles, isConnected, headType } = this.props;
        const { selectFileName, selectFileType } = this.state;
        const isHeadType = selectFileType === headType;
        const actions = this.actions;
        const hasFile = gcodeFiles.length > 0;

        return (
            <div>
                <div>
                    {_.map(gcodeFiles, (gcodeFile) => {
                        const name = gcodeFile.name.length > 33
                            ? `${gcodeFile.name.substring(0, 15)}......${gcodeFile.name.substring(gcodeFile.name.length - 10, gcodeFile.name.length)}`
                            : gcodeFile.name;
                        let size = '';
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
                            <div key={gcodeFile.uploadName}>
                                <Anchor
                                    className={classNames(
                                        styles['gcode-file'],
                                        { [styles.selected]: selectFileName === gcodeFile.uploadName }
                                    )}
                                    onClick={() => {
                                        actions.onSelectFile(gcodeFile.uploadName);
                                    }}
                                >
                                    <div className={styles['gcode-file-img']}>
                                        <img
                                            src={gcodeFile.img}
                                            alt=""
                                        />
                                    </div>
                                    <div className={styles['gcode-file-text']}>
                                        <div className={styles['gcode-file-text-name']}>
                                            {name}
                                        </div>
                                        <div className={styles['gcode-file-text-info']}>
                                            <span>{size}</span>
                                            <span>{date}</span>
                                        </div>
                                    </div>
                                </Anchor>
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
                        <Anchor
                            className={classNames(styles['gcode-file'], styles['gcode-file-upload'])}
                            onClick={actions.onClickToUpload}
                        >
                            <i className={classNames(styles['icon-24'], styles['icon-plus'])} />
                            {i18n._('Upload Files')}
                        </Anchor>
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
                    disabled={!(hasFile && isConnected && isHeadType)}
                    onClick={actions.sendFile}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Transfer via Wi-F')}
                </button>
            </div>

        );
    }
}

const mapStateToProps = (state) => {
    const { gcodeFiles } = state.workspace;
    const { server, isConnected, headType } = state.machine;

    return {
        gcodeFiles,
        headType,
        isConnected,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        uploadGcodeFile: (fileInfo) => dispatch(workspaceActions.uploadGcodeFile(fileInfo))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WifiTransport);
