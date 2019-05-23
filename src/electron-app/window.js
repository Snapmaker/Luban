import { Menu, shell } from 'electron';

// The selection menu
const selectionMenu = Menu.buildFromTemplate([
    { role: 'copy' }
]);

// The input menu
const inputMenu = Menu.buildFromTemplate([
    { role: 'copy' },
    { role: 'paste' }
]);


function configureWindow(window) {
    // Open every external link in a new window
    // https://github.com/electron/electron/blob/master/docs/api/web-contents.md
    window.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
    });

    // https://github.com/electron/electron/issues/4068#issuecomment-274159726
    window.webContents.on('context-menu', (event, props) => {
        const { selectionText, isEditable } = props;

        if (isEditable) {
            // Shows an input menu if editable
            inputMenu.popup(window);
        } else if (selectionText && String(selectionText).trim() !== '') {
            selectionMenu.popup(window);
        }
    });
}

export { configureWindow };
