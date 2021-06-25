import React, { PureComponent } from 'react';
import classNames from 'classnames';
import isElectron from 'is-electron';
import Menu from './Menu';
import styles from './appbar.styl';
import UniApi from '../../../lib/uni-api';
import i18n from '../../../lib/i18n';
import { renderModal } from '../../utils';
import FirmwareTool from '../../Pages/Settings/FirmwareTool';
import General from '../../Pages/Settings/General';
import SettingsMenu from '../../Pages/Settings';

class AppBar extends PureComponent {
    fileInputRef = React.createRef();

    accept = ['.snap3dp', '.snaplzr', '.snapcnc', '.gcode', '.cnc', '.nc']

    actions = {
        openDialog: () => {
            this.fileInputRef.current.value = null;
            this.fileInputRef.current.click();
        },
        onchange: (e) => {
            const file = e.target.files[0];
            const recentFile = {
                name: file.name,
                path: file.path || ''
            };
            UniApi.Event.emit('appbar-menu:open-file', file, [recentFile]);
        },
        showSettings() {
            const location = {
                pathname: '/settings/general'
            };
            function onClose() {}
            return renderModal({
                title: i18n._('Preferences'),
                renderBody() {
                    return <SettingsMenu location={location} />;
                },
                size: 'large',
                actions: [
                    {
                        name: i18n._('Yes'),
                        isPrimary: true,
                        onClick: () => {
                            // actions.onRecovery();
                            onClose();
                        }
                    },
                    {
                        name: i18n._('Cancel'),
                        onClick: () => { onClose(); }
                    }
                ],
                onClose
            });
        },
        showFirmwareTool() {
            function onClose() {}
            return renderModal({
                title: i18n._('Firmware Tool'),
                renderBody() {
                    return <FirmwareTool />;
                },
                actions: [
                    {
                        name: i18n._('Yes'),
                        isPrimary: true,
                        onClick: () => {
                            // actions.onRecovery();
                            onClose();
                        }
                    },
                    {
                        name: i18n._('Cancel'),
                        onClick: () => { onClose(); }
                    }
                ],
                onClose
            });
        },
        showSoftwareUpdate() {
            function onClose() {}
            return renderModal({
                title: i18n._('Preferences'),
                renderBody() {
                    return <General updateShouldCheckForUpdate={() => {}} actions={{ load: () => {} }} state={{ api: { loading: false } }} />;
                },
                size: 'large',
                actions: [
                    {
                        name: i18n._('Yes'),
                        isPrimary: true,
                        onClick: () => {
                            // actions.onRecovery();
                            onClose();
                        }
                    },
                    {
                        name: i18n._('Cancel'),
                        onClick: () => { onClose(); }
                    }
                ],
                onClose
            });
        }
    }

    componentDidMount() {
        UniApi.Event.on('appbar-menu:open-file-in-browser', () => {
            this.actions.openDialog();
        });
    }

    render() {
        return (
            <div className={classNames(styles['lu-appbar'])}>
                <input
                    type="file"
                    accept={this.accept.join(',')}
                    onChange={this.actions.onchange}
                    className={classNames(styles['file-select'])}
                    ref={this.fileInputRef}
                />
                { isElectron() ? null : <Menu /> }
            </div>
        );
    }
}

export default AppBar;
