import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../../api';
import i18n from '../../../lib/i18n';
import WarningModal from '../../../lib/modal-warning';
import Modal from '../../components/Modal';
import Space from '../../components/Space';

import { actions as laserActions } from '../../../flux/laser';
import ExtractSquareTrace from './ExtractSquareTrace';

const PANEL_EXTRACT_TRACE = 1;
const PANEL_NOT_CALIBRATION = 3;
const iconSrc = 'images/camera-aid/ic_warning-64x64.png';

const SetBackground = ({ hideModal, materialThickness }) => {
    const dispatch = useDispatch();
    const address = useSelector(state => state?.machine?.server?.address);
    const size = useSelector(state => state?.machine?.size);
    const toolHead = useSelector(state => state.machine.toolHead);

    const [canTakePhoto, setCanTakePhoto] = useState(true);
    const [xSize, setXSize] = useState([]);
    const [ySize, setYSize] = useState([]);
    const [lastFileNames, setLastFileNames] = useState([]);
    const [panel, setPanel] = useState(PANEL_EXTRACT_TRACE);

    const actions = {
        showModal: async () => {
            const resPro = await api.getCameraCalibration({ 'address': address, 'toolHead': toolHead.laserToolhead });
            if (!('res' in resPro.body) || !('points' in JSON.parse(resPro.body.res.text))) {
                setPanel(PANEL_NOT_CALIBRATION);
            } else {
                setPanel(PANEL_EXTRACT_TRACE);
            }
        },
        changeLastFileNames: (newLastFileNames) => {
            setLastFileNames(newLastFileNames);
        },
        updateEachPicSize: (sizeName, value) => {
            if (sizeName === 'xSize') {
                setXSize(value);
            }
            if (sizeName === 'ySize') {
                setYSize(value);
            }
        },
        changeCanTakePhoto: (newCanTakePhoto) => {
            setCanTakePhoto(newCanTakePhoto);
        },
        hideModal: () => {
            if (!canTakePhoto && panel === PANEL_EXTRACT_TRACE) {
                WarningModal({
                    body: i18n._('key-Laser/CameraCapture-This action cannot be undone. Are you sure you want to stop the job?'),
                    iconSrc,
                    bodyTitle: i18n._('key-Laser/CameraCapture-Warning'),
                    insideHideModal: hideModal
                });
            } else {
                hideModal();
            }
        },
        setBackgroundImage: (filename) => {
            dispatch(laserActions.setBackgroundImage(filename, size.x, size.y, 0, 0));

            actions.hideModal();
        }
    };

    return (
        <React.Fragment>
            <div>
                <ExtractSquareTrace
                    toolHead={toolHead}
                    canTakePhoto={canTakePhoto}
                    changeCanTakePhoto={actions.changeCanTakePhoto}
                    ySize={ySize}
                    xSize={xSize}
                    hideModal={hideModal}
                    lastFileNames={lastFileNames}
                    updateEachPicSize={actions.updateEachPicSize}
                    changeLastFileNames={actions.changeLastFileNames}
                    setBackgroundImage={actions.setBackgroundImage}
                    materialThickness={materialThickness}
                />

                {panel === PANEL_NOT_CALIBRATION && (
                    <Modal style={{ paddingBottom: '10px' }} size="lg" onClose={actions.hideModal}>
                        <Modal.Header>
                            {i18n._('key-Laser/CameraCapture-Warning')}
                        </Modal.Header>
                        <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                            <div>
                                {i18n._('key-Laser/CameraCapture-Information')}
                                <br />
                                <Space width={4} />
                                {i18n._('The camera hasn\'t been calibrated yet. Please go through the Camera Calibration procedures on touchscreen first.')}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <div style={{ display: 'inline-block', marginRight: '8px' }}>
                                <input
                                    type="checkbox"
                                    defaultChecked={false}
                                />
                                <span style={{ paddingLeft: '4px' }}>{i18n._('Don\'t show again in current session')}</span>
                            </div>
                        </Modal.Footer>
                    </Modal>
                )}
            </div>
        </React.Fragment>
    );
};

SetBackground.propTypes = {
    hideModal: PropTypes.func.isRequired,
    materialThickness: PropTypes.number
};

export default SetBackground;
