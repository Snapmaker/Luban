import { renderModal } from '../../../utils';
import i18n from '../../../../lib/i18n';


const JobSetupModal = () => {
    return renderModal({
        title: i18n._('key-CncLaser/JobSetup-Job Setup'),
        renderBody: () => {
            return null;
        },
        actions: [

        ],
        onClose: () => {
            // console.log('onClose');
        },
    });
};

export default JobSetupModal;
