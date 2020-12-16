import React from 'react';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';

import Modal from '../../components/Modal';
import i18n from '../../lib/i18n';
import styles from './styles.styl';

const Instructions = ({ onClose }) => {
    return (
        <Modal style={{ width: '1080px' }} size="lg" onClose={onClose}>
            <Modal.Header>
                <Modal.Title>
                    {i18n._('How to Configure Camera Aid Background')}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div
                    className={styles['laser-set-background-instruction-step']}
                    style={{
                        width: '50%',
                        display: 'inline-block',
                        float: 'left'
                    }}
                >
                    <p>
                        <Trans>
                            The Camera Aid Background feature enables you to place the material and the image to be
                            engraved together and adjust their position on the software by using a phone with a camera.
                            It helps to engrave the image on your material in a much more accurate way.
                        </Trans>
                    </p>

                    <ol>
                        <li>
                            <Trans>
                                1. Place a piece of paper or wood sheet on the Engraving & Carving Platform.
                            </Trans>
                        </li>
                        <li>
                            <Trans>
                                2. Set the work origin as how you did before.
                            </Trans>
                        </li>
                        <li>
                            <Trans>
                                3. Go to <b>Laser G-code Generator</b> &gt; <b>Set Background</b>.
                                Click <b>Add Background</b>.
                            </Trans>
                        </li>
                        <li>
                            <Trans>
                                4. Print a square to locate your material.
                            </Trans>
                        </li>
                    </ol>

                    <div className={styles['laser-set-background-instruction-step-detail']} style={{ marginLeft: '25px' }}>
                        <ol>
                            <li>
                                <Trans>
                                    Set the <b>Side Length</b> and <b>Power</b> of the square.
                                    The square should be larger than the material that will be engraved.
                                    Click <b>Engrave Square</b>.
                                </Trans>
                            </li>
                            <li>
                                <Trans>
                                    After the square is engraved, place the material inside the square and take a photo.
                                    The four corners of the square must be in the photo. Also, to achieve the best
                                    result, try to keep the lens and the heated bed parallel.
                                </Trans>
                            </li>
                            <li>{i18n._('Send the photo to your computer.')}</li>
                            <li>
                                <Trans>
                                    On the software, click <b>Next</b>. Click <b>Upload</b> to upload the photo.
                                    Move the four corners of the dashed box to overlap the four corners of the engraved
                                    square.
                                </Trans>
                            </li>
                            <img
                                style={{
                                    width: '250px',
                                    height: '300px',
                                    display: 'block',
                                    margin: '4px auto'
                                }}
                                src="images/laser/laser_camera-aid-bg-instructions-01-250x321.png"
                                role="presentation"
                                alt="x"
                            />
                            <li>
                                <Trans>
                                    Click <b>Extract</b> and then <b>Complete</b>.
                                    Now the printer knows where your material is on the platform.
                                </Trans>
                            </li>
                        </ol>
                    </div>
                </div>
                <div
                    className={styles['laser-set-background-instruction-step']}
                    style={{
                        width: '50%',
                        display: 'inline-block',
                        float: 'right'
                    }}
                >
                    <ol>
                        <li>
                            <Trans>
                                5. Add the image or text you need to engrave on the background and complete the settings
                                based on your needs.
                            </Trans>
                        </li>
                        <img
                            style={{ width: '250px', height: '251px', display: 'block', margin: '4px auto' }}
                            src="images/laser/laser_camera-aid-bg-instructions-02-250x251.png"
                            role="presentation"
                            alt="x"
                        />
                        <li>
                            <Trans>
                                6. Click <b>Generate G-code</b> and then <b>Load G-code to Workspace</b>.
                            </Trans>
                        </li>
                        <li>
                            <Trans>
                                7. Set the work origin only on the Z direction again so that the printer can engrave on
                                the surface of the material.
                                Click <b>Z</b> &gt; <b>Zero Out Temporary Z Axis</b> to save the new origin.
                            </Trans>
                        </li>
                        <img
                            style={{ width: '250px', height: '80px', display: 'block', margin: '4px auto' }}
                            src="images/laser/laser_camera-aid-bg-instructions-03-250x80.png"
                            role="presentation"
                            alt="x"
                        />
                        <p>{i18n._('Note: If you use the USB disk to engrave, please make sure you set the work origin in the software instead of on the touchscreen.')}</p>
                        <li>
                            <Trans>
                                8. Set <b>Work Power</b> and start the engraving.
                            </Trans>
                        </li>
                    </ol>
                </div>
                <div className="clearfix" />
            </Modal.Body>
        </Modal>
    );
};

Instructions.propTypes = {
    onClose: PropTypes.func.isRequired
};

export default React.memo(Instructions);
