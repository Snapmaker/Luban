import React, { useRef } from 'react';

import i18n from '../../../../lib/i18n';
import { renderModal } from '../../../utils';
import JobSetupView, { JobSetupViewHandle } from './JobSetupView';

interface JobSetupModalProps {
    onClose?: () => void;
}

const JobSetupModal: React.FC<JobSetupModalProps> = (props) => {
    const { onClose } = props;

    const jobSetupViewRef = useRef<JobSetupViewHandle>();

    return renderModal({
        title: i18n._('key-CncLaser/JobSetup-Job Setup'),
        renderBody: () => {
            return <JobSetupView ref={jobSetupViewRef} />;
        },
        actions: [
            {
                name: i18n._('key-CncLaser/JobSetup-Cancel'),
                onClick: () => {
                    onClose && onClose();
                }
            },
            {
                name: i18n._('key-CncLaser/JobSetup-Confirm'),
                isPrimary: true,
                onClick: () => {
                    if (jobSetupViewRef.current) {
                        jobSetupViewRef.current.onChange();
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

export default JobSetupModal;
