import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import CalibrationPreview, { CUTOUT_MODE } from './ManualCalibration';
// import Anchor from '../../../components/Anchor';
import Modal from '../../../components/Modal';
import { Button } from '../../../components/Buttons';
import styles from '../styles.styl';

const PickObject = (props) => {
    const calibrationPreview = useRef(null);
    useEffect(() => {
        if (calibrationPreview.current) {
            calibrationPreview.current.onChangeImage(props.fileName, props.size.x, props.size.y);
        }
        return () => {
            props.resetPanel();
        };
    }, [calibrationPreview]);

    const actions = {
        onClickToConfirm: async () => {
            const outputUri = await calibrationPreview.current.exportPreviewImage();
            props.resetPanel();
            props.onClipImage(outputUri);
        },
        previousPanel: () => {
            props.resetPanel();
        }
    };

    return (
        <React.Fragment>
            <Modal onClose={actions.previousPanel}>
                <div className="clearfix" />
                <Modal.Header>
                    <div className={styles['laser-set-background-calibration-title']}>
                        {i18n._('key-Laser/CameraCapture-Calibrate')}
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['laser-set-background-modal-content']}>
                        <div className={styles['calibrate-background']}>
                            <div className={styles['calibrate-advise']}>
                                <p style={{ marginBottom: '1rem', textAlign: 'left' }}>
                                    {i18n._('key-Laser/CamaeraCapture-Workpiece contour matching')}
                                </p>
                            </div>

                        </div>
                        <CalibrationPreview
                            ref={calibrationPreview}
                            getPoints={[]}
                            width={props.size.x}
                            height={props.size.y}
                            mode={CUTOUT_MODE}
                            materialThickness={props.materialThickness}
                            series={props.series}
                            size={props.size}
                            toolHead={props.toolHead}
                            updateAffinePoints={() => {

                            }}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div style={{ minHeight: 30 }}>
                        <Button
                            width="96px"
                            priority="level-two"
                            type="default"
                            className={classNames(
                                styles['btn-camera'],
                                'float-l'
                            )}
                            onClick={actions.previousPanel}
                        >
                            {i18n._('key-Laser/CameraCapture-Back')}
                        </Button>
                        <Button
                            priority="level-two"
                            width="96px"
                            className={classNames(
                                // styles[state.isComfirmPoints ? 'btn-right-camera' : 'btn-right-camera-disabled border-radius-8'],
                            )}
                            onClick={actions.onClickToConfirm}
                        >
                            {i18n._('key-Laser/CameraCapture-Apply')}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
};
PickObject.propTypes = {
    materialThickness: PropTypes.number.isRequired,
    fileName: PropTypes.string.isRequired,
    resetPanel: PropTypes.func.isRequired,
    onClipImage: PropTypes.func.isRequired,
    series: PropTypes.string.isRequired,
    size: PropTypes.object.isRequired,
    toolHead: PropTypes.object.isRequired
};

export default PickObject;
