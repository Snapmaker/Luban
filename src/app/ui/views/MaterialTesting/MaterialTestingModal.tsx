import React, { useRef } from 'react';

import i18n from '../../../lib/i18n';
import { renderModal } from '../../utils';
import MaterialTestingView, { MaterialTestingViewHandle } from './MaterialTestingView';

interface MaterialTestingModalProps {
    onClose?: () => void;
}

const MaterialTestingModal: React.FC<MaterialTestingModalProps> = (props) => {
    const { onClose } = props;

    const MaterialTestingViewRef = useRef<MaterialTestingViewHandle>();

    return renderModal({
        title: i18n._('key-Laser/MainToolBar-MaterialTesting'),
        renderBody: () => {
            return <MaterialTestingView ref={MaterialTestingViewRef} />;
        },
        actions: [
            {
                name: i18n._('key-Modal/Common-Cancel'),
                onClick: () => {
                    onClose && onClose();
                }
            },
            {
                name: i18n._('key-Modal/Common-Confirm'),
                isPrimary: true,
                onClick: () => {
                    if (MaterialTestingViewRef.current) {
                        MaterialTestingViewRef.current.onChange();
                    }
                    onClose && onClose();
                }
            }
        ],
        onClose: () => {
            onClose && onClose();
        },
    });
};

export default MaterialTestingModal;
