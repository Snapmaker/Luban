import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';
import { connect } from 'react-redux';
import _ from 'lodash';
import jQuery from 'jquery';
import Anchor from '../../components/Anchor';
import i18n from '../../lib/i18n';
import widgetStyles from '../styles.styl';
import styles from './index.styl';
import { DATA_PREFIX } from '../../constants';
import { actions as workspaceActions } from '../../flux/workspace';
import api from '../../api';


// import controller from '../../lib/controller';


class WifiTransport extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        gcodeFiles: PropTypes.array.isRequired,
        isConnected: PropTypes.bool.isRequired,
        server: PropTypes.object.isRequired,

        clearGcode: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        addGcodeFile: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        selectFileName: ''
    };

    actions = {
        onSelectFile: (selectFileName) => {
            if (this.state.selectFileName === selectFileName) {
                this.setState({
                    selectFileName: ''
                });
            } else {
                this.setState({
                    selectFileName: selectFileName
                });
            }
        },
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            api.uploadFile(formData)
                .then((res) => {
                    const response = res.body;
                    this.props.addGcodeFile({
                        name: file.name,
                        uploadName: response.uploadName,
                        size: file.size,
                        lastModifiedDate: file.lastModifiedDate,
                        img: ''
                    });
                })
                .catch(() => {
                    // Ignore error
                });
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        sendFile: () => {
            console.log(this.props.isConnected);
            console.log(this.props.server);
        },
        loadGcodeToWorkspace: () => {
            const selectFileName = this.state.selectFileName;
            const find = this.props.gcodeFiles.find(v => v.name === selectFileName);
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

    render() {
        const { gcodeFiles } = this.props;
        const { selectFileName } = this.state;
        const actions = this.actions;
        const hasFile = gcodeFiles.length > 0;

        return (
            <div>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept=".gcode, .nc .cnc"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <button
                    type="button"
                    className="sm-btn-small sm-btn-default"
                    onClick={actions.onClickToUpload}
                    style={{ display: 'block', width: '50%' }}
                >
                    {i18n._('Upload File')}
                </button>
                {hasFile && (
                    <div>
                        <div style={{
                            'marginTop': '6px'
                        }}
                        >
                            {i18n._('Stack')}
                        </div>
                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />

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
                                            { [styles.selected]: selectFileName === gcodeFile.name }
                                        )}
                                        onClick={() => {
                                            actions.onSelectFile(gcodeFile.name);
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

                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-default"
                            onClick={actions.loadGcodeToWorkspace}
                            style={{ display: 'block', width: '100%', marginBottom: '10px' }}
                        >
                            {i18n._('Load G-code to Workspace')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-default"
                            onClick={actions.removeBackgroundImage}
                            style={{ display: 'block', width: '100%' }}
                        >
                            {i18n._('Transfer By WiFi')}
                        </button>
                    </div>
                )}
            </div>

        );
    }
}

const mapStateToProps = (state) => {
    const { gcodeFiles } = state.workspace;
    const { server, isConnected } = state.machine;

    return {
        gcodeFiles,
        server,
        isConnected
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        addGcodeFile: (fileInfo) => dispatch(workspaceActions.addGcodeFile(fileInfo))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WifiTransport);
