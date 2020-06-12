import { app, shell } from 'electron';


export default function getMenuTemplate(options) {
    const { address, port } = { ...options };

    const template = [
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                {
                    label: 'View In Browser',
                    click: () => {
                        const url = `http://${address}:${port}`;
                        shell.openExternal(url);
                    }
                },
                { role: 'toggledevtools' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        // About
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services', submenu: [] },
                { type: 'separator' },
                {
                    role: 'hide',
                    label: 'Hide'
                },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                {
                    role: 'quit',
                    label: 'Quit'
                }
            ]
        });
    }

    return template;
}
