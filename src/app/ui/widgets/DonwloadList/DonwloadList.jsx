import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
// import classNames from 'classnames';
import noop from 'lodash';
// import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';

import i18n from '../../../lib/i18n';

function DonwloadList({ onClose = noop }) {
    const progress = useSelector(state => state.appGlobal.progress);
    const [fileList, setFileList] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            const { ipcRenderer } = window.require('electron');
            const lists = await ipcRenderer.invoke('getStoreValue', 'downloadFileLists');
            console.log('', lists);
            setFileList(lists);
        };
        fetchData()
            .catch(console.error);
    }, []);
    console.log('', progress, fileList);

    return (
        <>
            <Modal onClose={onClose} title={i18n._('key-DonwloadList/Download Directory')}>
                <Modal.Header>
                    {i18n._(
                        'key-DonwloadList/Download Directory'
                    )}
                </Modal.Header>
                <Modal.Body>
                    <div />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type="default"
                        width="96px"
                        priority="level-two"
                    >
                        {i18n._(
                            'key-DonwloadList/Delete All'
                        )}
                    </Button>
                    <Button
                        onClick={onClose}
                        type="default"
                        width="96px"
                        priority="level-two"
                    >
                        {i18n._(
                            'key-DonwloadList/Close'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

DonwloadList.propTypes = {
    onClose: PropTypes.func,
};
export default DonwloadList;
