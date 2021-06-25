import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'connection',
    label: 'Connection',
    submenu: [
        {
            label: 'Connection',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('navigate-to-workspace');
                } else {
                    UniApi.Event.emit('navigate-to-workspace');
                }
            }
        }
    ]
};
