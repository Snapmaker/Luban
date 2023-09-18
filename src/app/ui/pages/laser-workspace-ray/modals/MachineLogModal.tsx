import { Alert } from 'antd';
import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';

import SocketEvent from '../../../../communication/socket-events';
import { RootState } from '../../../../flux/index.def';
import controller from '../../../../communication/socket-communication';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import { toast } from '../../../components/Toast';
import { makeSceneToast } from '../../../views/toasts/SceneToast';

interface ExportLogModalProps {
    onClose?: () => void;
}

const ExportLogModal: React.FC<ExportLogModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    const [isExporting, setIsExporting] = useState(false);

    const exportLog = useCallback(() => {
        setIsExporting(true);

        controller
            .emitEvent(SocketEvent.ExportLogToExternalStorage)
            .once(SocketEvent.ExportLogToExternalStorage, ({ err }) => {
                setIsExporting(false);
                if (!err) {
                    // success
                    toast(makeSceneToast('info', i18n._('Export log successfully.')));
                } else {
                    // failed
                    toast(makeSceneToast('error', i18n._('Failed to export log.')));
                }
            });
    }, []);

    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('Machine Log')}
            </Modal.Header>
            <Modal.Body className="width-432">
                {
                    !isConnected && (
                        <Alert
                            type="error"
                            message={i18n._('key-Workspace/Machine not connected, please connect to the machine first.')}
                        />
                    )
                }
                {
                    isConnected && (
                        <div>
                            <span>{i18n._('Export machine log to SD card.')}</span>
                        </div>
                    )
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={exportLog}
                    disabled={!isConnected || isExporting}
                >
                    {
                        !isExporting && i18n._('Export')
                    }
                    {
                        isExporting && i18n._('Exporting')
                    }
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ExportLogModal;
