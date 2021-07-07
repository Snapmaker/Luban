import React, { PureComponent } from 'react';
import classNames from 'classnames';
import isElectron from 'is-electron';
import Menu from './Menu';
import styles from './appbar.styl';
import UniApi from '../../../lib/uni-api';

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
