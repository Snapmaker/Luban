import isElectron from 'is-electron';

/**
 * Dialogs control in electron
 */
const Dialog = {
    async showOpenFileDialog(type, isMultiSelect) {
        type = typeof type === 'string' ? type.slice(1) : '';
        let extensions = ['snap3dp', 'snaplzr', 'snapcnc'];
        switch (type) { // substring '/3dp' to '3dp'
            case 'printing':
                extensions = ['stl', 'obj', '3mf', 'amf'];
                break;
            case 'laser-rotate':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf'];
                break;
            case 'laser':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf', 'stl', '3mf', 'amf'];
                break;
            case 'cnc':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf', 'stl', '3mf', 'amf'];
                break;
            case 'workspace':
                extensions = ['gcode', 'nc', 'cnc'];
                break;
            default: break;
        }

        if (isElectron()) {
            const remote = window.require('@electron/remote');
            const currentWindow = remote.getCurrentWindow();
            const defaultProperties = ['createDirectory', 'openFile'];
            const openDialogReturnValue = await remote.dialog.showOpenDialog(
                currentWindow,
                {
                    title: 'Snapmaker Luban',
                    filters: [{ name: 'files', extensions }],
                    properties: isMultiSelect ? defaultProperties.concat('multiSelections') : defaultProperties
                }
            );
            const filePaths = openDialogReturnValue.filePaths;
            if (!filePaths || !filePaths[0]) return null;
            if (isMultiSelect) {
                const files = filePaths.map(item => {
                    return { path: item, name: window.require('path').basename(item) };
                });
                return files;
            } else {
                const file = { path: filePaths[0], name: window.require('path').basename(filePaths[0]) };
                return file;
            }
        }
        return null;
    },
    showMessageBox(options, modal = true) {
        if (isElectron()) {
            const remote = window.require('@electron/remote');
            const { dialog } = remote;
            options.title = 'Snapmaker Luban';
            if (modal) {
                const currentWindow = remote.getCurrentWindow();
                return dialog.showMessageBox(currentWindow, options);
            }
            return dialog.showMessageBox(options);
        } else {
            return window.confirm(options.message);
        }
    },
    showSaveDialog(options, modal = true) {
        if (isElectron()) {
            const remote = window.require('@electron/remote');
            const { dialog } = remote;
            options.title = 'Snapmaker Luban';
            if (modal) {
                const currentWindow = remote.getCurrentWindow();
                return dialog.showSaveDialog(currentWindow, options);
            }
            return dialog.showSaveDialog(options);
        }
        return null;
    }
};


export default Dialog;
