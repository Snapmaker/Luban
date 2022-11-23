import React, { PureComponent } from 'react';
import request from 'superagent';
import FileSaver from 'file-saver';
// import { TextInput } from '../../../components/Input';
import api from '../../../../api';
import i18n from '../../../../lib/i18n';
import UniApi from '../../../../lib/uni-api';

class FirmwareTool extends PureComponent {
    mainInput = React.createRef();

    moduleInput = React.createRef();

    state = {
        mainFile: null,
        moduleFile: null,
        buildVersion: '3.2.0'
    };

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
            <div>
                <div className="sm-flex height-28 margin-bottom-8">
                    <span className="width-136">{i18n._('key-App/Settings/FirmwareTool-Controller Firmware')}</span>
                    <input
                        ref={this.mainInput}
                        className="margin-left-32 "
                        type="file"
                        accept=".bin"
                        multiple={false}
                        onChange={actions.onChangeMainFile}
                    />
                </div>
                <div className="sm-flex height-28">
                    <span className="width-136">{i18n._('key-App/Settings/FirmwareTool-Module Firmware')}</span>
                    <input
                        ref={this.moduleInput}
                        className="margin-left-32 "
                        type="file"
                        accept=".bin"
                        multiple={false}
                        onChange={actions.onChangeModuleFile}
                    />
                </div>
                {shouldShowWarning && (
                    <span className="margin-top-10 display-inline color-red-1">
                        {i18n._('key-App/Settings/FirmwareTool-Please select one or more firmware binaries')}
                    </span>
                )}
            </div>
        );
    }
}

export default FirmwareTool;
