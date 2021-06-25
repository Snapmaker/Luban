import React, { PureComponent } from 'react';
import request from 'superagent';
import FileSaver from 'file-saver';
// import { TextInput } from '../../../components/Input';
import api from '../../../../api';
import i18n from '../../../../lib/i18n';
import styles from './index.styl';
import UniApi from '../../../../lib/uni-api';

class FirmwareTool extends PureComponent {
    mainInput = React.createRef();

    moduleInput = React.createRef();

    state = {
        mainFile: null,
        moduleFile: null,
        buildVersion: '3.2.0'
    }

    actions = {
        onChangeMainFile: (event) => {
            this.setState({
                mainFile: event.target.files[0]
            });
        },
        // changeVersion: (event) => {
        //     this.setState({ buildVersion: event.target.value });
        // },
        onChangeModuleFile: (event) => {
            this.setState({
                moduleFile: event.target.files[0]
            });
        },
        testVersion: (buildVersion) => {
            return /(([0-9]|([1-9]([0-9]*))).){2}([0-9]|([1-9]([0-9]*)))/.test(buildVersion);
        },
        onClickToBuildAndExport: () => {
            const { mainFile, moduleFile } = this.state;
            const buildVersion = this.state.buildVersion;
            const formData = new FormData();
            if (mainFile) {
                formData.append('mainFile', mainFile);
            }
            if (moduleFile) {
                formData.append('moduleFile', moduleFile);
            }
            if (mainFile || moduleFile) {
                // if (!this.actions.testVersion(buildVersion)) {
                //     buildVersion = '3.2.0';
                // }
                formData.append('buildVersion', buildVersion);
                api.buildFirmwareFile(formData)
                    .then((res) => {
                        const packageName = res.body.packageName;
                        if (packageName) {
                            request.get(`/data/Tmp/${packageName}`).responseType('blob').end((err, result) => {
                                FileSaver.saveAs(result.body, packageName, true);
                            });
                        }
                    });
            }
        }
    };

    componentDidMount() {
        UniApi.Event.on('appbar-menu:firmware-tools.export', this.actions.onClickToBuildAndExport);
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:firmware-tools.export', this.actions.onClickToBuildAndExport);
    }

    render() {
        const actions = this.actions;
        const state = this.state;
        const shouldShowWarning = !state.mainFile && !state.moduleFile;

        return (
            <div style={{ marginBottom: '55px' }}>
                <ul className={styles.firmware}>
                    <li className={styles.wrapper}>
                        <span className={styles.labelText}>{i18n._('Controller Firmware')}</span>
                        <input
                            ref={this.mainInput}
                            className={styles.mainInput}
                            type="file"
                            accept=".bin"
                            multiple={false}
                            onChange={actions.onChangeMainFile}
                        />
                    </li>
                    <li className={styles.wrapper}>
                        <span className={styles.labelText}>{i18n._('Module Firmware')}</span>
                        <input
                            ref={this.moduleInput}
                            className={styles.moduleInput}
                            type="file"
                            accept=".bin"
                            multiple={false}
                            onChange={actions.onChangeModuleFile}
                        />
                    </li>
                </ul>
                {/* <div className={styles.buildButton}>
                    <button
                        type="button"
                        disabled={shouldShowWarning}
                        className="sm-btn-small sm-btn-primary"
                        onClick={() => actions.onClickToBuildAndExport()}
                    >
                        {i18n._('Compile and Export')}
                    </button>
                </div> */}
                {shouldShowWarning && (
                    <p className={styles.warningNotes}>
                        {i18n._('Please select one or more firmware binaries')}
                    </p>
                )}
            </div>
        );
    }
}

export default FirmwareTool;
