import classNames from 'classnames';
import isElectron from 'is-electron';
import React, { useCallback, useEffect, useRef } from 'react';

import UniApi from '../../../lib/uni-api';
import Menu from './Menu';
import styles from './styles.styl';

const accept = ['.snap3dp', '.snaplzr', '.snapcnc'];

function AppBar() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const openDialog = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
            fileInputRef.current.click();
        }
    }, []);

    const onchange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const file = e.target.files[0];
            const recentFile = {
                name: file.name,
                path: file.path || ''
            };
            UniApi.Event.emit('appbar-menu:open-file', file, [recentFile]);
        }
    }, []);

    useEffect(() => {
        UniApi.Event.on('appbar-menu:open-file-in-browser', openDialog);

        // Cleanup
        return () => {
            UniApi.Event.off('appbar-menu:open-file-in-browser', openDialog);
        };
    }, [openDialog]);

    return (
        <div className={classNames(styles['lu-appbar'])}>
            <input
                type="file"
                accept={accept.join(',')}
                onChange={onchange}
                className={classNames(styles['file-select'])}
                ref={fileInputRef}
            />
            {
                !isElectron() && (<Menu />)
            }
        </div>
    );
}

export default AppBar;
