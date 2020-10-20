// import classNames from 'classnames';
import React, { PureComponent } from 'react';
// import PropTypes from 'prop-types';
import api from '../../../api';
import i18n from '../../../lib/i18n';
// import Anchor from '../../../components/Anchor';
// import Space from '../../../components/Space';
// import styles from './index.styl';

class General extends PureComponent {
    // static propTypes = {
    // };

    mainInput = React.createRef();

    moduleInput = React.createRef();

    state = {
        mainFile: null,
        moduleFile: null
    }

    actions = {
        onClickToUploadMain: () => {
            this.mainInput.current.value = null;
            this.mainInput.current.click();
        },
        onClickToUploadModule: () => {
            this.moduleInput.current.value = null;
            this.moduleInput.current.click();
        },
        onChangeMainFile: (event) => {
            this.setState({
                mainFile: event.target.files[0]
            });
        },
        onChangeModuleFile: (event) => {
            this.setState({
                moduleFile: event.target.files[0]
            });
        },
        onClickToBuild: async () => {
            const { mainFile, moduleFile } = this.state;
            const formData = new FormData();
            const binFiles = {
                mainFile: mainFile,
                moduleFile: moduleFile
            };
            formData.append('binFiles', binFiles);
            formData.append('mainFile', mainFile);
            formData.append('moduleFile', moduleFile);
            console.log('onClickToBuild', binFiles);
            await api.buildFirmwareFile(formData);
        }
    };

    componentDidMount() {
    }

    render() {
        const actions = this.actions;

        return (
            <div style={{ marginBottom: '55px' }}>
                <ul className="firmware">
                    <li>
                        {i18n._('主控固件')}
                        <input
                            ref={this.mainInput}
                            type="file"
                            accept=".bin"
                            multiple={false}
                            onChange={actions.onChangeMainFile}
                        />
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            title={i18n._('Brow')}
                            onClick={() => actions.onClickToUploadMain()}
                        >
                            {i18n._('Brow')}
                        </button>
                    </li>
                    <li>
                        {i18n._('模块固件')}
                        <input
                            ref={this.moduleInput}
                            type="file"
                            accept=".bin"
                            multiple={false}
                            onChange={actions.onChangeModuleFile}
                        />
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            title={i18n._('Brow')}
                            onClick={() => actions.onClickToUploadModule()}
                        >
                            {i18n._('Brow')}
                        </button>
                    </li>
                </ul>
                <div className="build">
                    <button
                        type="button"
                        className="sm-btn-small sm-btn-primary"
                        onClick={() => actions.onClickToBuild()}
                    >
                        {i18n._('Build')}
                    </button>
                    <button
                        type="button"
                        className="sm-btn-small sm-btn-primary"
                    >
                        {i18n._('Export')}
                    </button>
                </div>
            </div>
        );
    }
}

export default General;
