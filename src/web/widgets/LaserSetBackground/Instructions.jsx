import React from 'react';
import PropTypes from 'prop-types';
import Space from '../../components/Space/Space';
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
                <div className={styles['laser-set-background-instruction-step']} style={{ width: '50%', display: 'inline-block', float: 'left' }}>
                    <p>{i18n._('The Camera Aid Background feature enables you to place the material and the image to be engraved together \
                        and adjust their position on the software by using a phone with a camera. \
                        It helps to engrave the image on your material in a much more accurate way.')}
                    </p>
                    <ol>
                        <li> 1. {i18n._('Place a piece of paper or wood sheet on the Engraving & Carving Platform.')}</li>
                        <li> 2. {i18n._('Set the work origin as how you did before.')}</li>
                        <li>
                            3.
                            <Space width={4} />
                            {i18n._('Go to')}
                            <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Laser G-code Generator')}</span>
                            {'>'}
                            <Space width={4} />
                            <span style={{ color: '#28a7e1' }}>{i18n._('Set Background')}</span>
                            {'.'}
                            <Space width={4} />
                            {i18n._('Click')}
                            <span style={{ color: '#28a7e1', padding: '0 0 0 4px' }}>{i18n._('Add Background')}</span>
                            {'.'}
                        </li>
                        <li> 4. {i18n._('Print a square to locate your material.')}</li>
                        <div className={styles['laser-set-background-instruction-step-detail']} style={{ marginLeft: '25px' }}>
                            <ol>
                                <li>
                                    {i18n._('Set the')}
                                    <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Side Length')}</span>
                                    {i18n._('and')}
                                    <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Power')}</span>
                                    {i18n._('of the square.')}
                                    <Space width={4} />
                                    {i18n._('The square should be larger than the material that will be engraved.')}
                                    <Space width={4} />
                                    {i18n._('Click')}
                                    <span style={{ color: '#28a7e1', padding: '0 0 0 4px' }}>{i18n._('Engrave Square')}</span>
                                    {'.'}
                                </li>
                                <li>{i18n._('After the square is engraved, place the material inside the square and take a photo. The four corners of the square must be in the photo. Also, to achieve the best result, try to keep the lens and the heated bed parallel.')}</li>
                                <li>{i18n._('Send the photo to your computer.')}</li>
                                <li>
                                    {i18n._('On Snapmakerjs')}
                                    {','}
                                    <Space width={4} />
                                    {i18n._('click')}
                                    <span style={{ color: '#28a7e1', padding: '0 0 0 4px' }}>{i18n._('Next')}</span>
                                    {'.'}
                                    <Space width={4} />
                                    {i18n._('Click')}
                                    <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Upload')}</span>
                                    {i18n._('to upload the photo. Move the four corners of the dashed box to overlap the four corners of the engraved square.')}
                                </li>
                                <img
                                    style={{ width: '201px', height: '258px', display: 'block', margin: '4px auto' }}
                                    src="images/laser/laser_camera-aid-bg-instructions-01.png"
                                    role="presentation"
                                    alt="x"
                                />
                                <li>
                                    {i18n._('Click')}
                                    <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Extract')}</span>
                                    {i18n._('and then')}
                                    <span style={{ color: '#28a7e1', padding: '0 0 0 4px' }}>{i18n._('Complete')}</span>
                                    {'.'}
                                    <Space width={4} />
                                    {i18n._('Now the printer knows where your material is on the platform.')}
                                </li>
                            </ol>
                        </div>
                    </ol>
                </div>
                <div className={styles['laser-set-background-instruction-step']} style={{ width: '50%', display: 'inline-block', float: 'right' }}>
                    <ol>
                        <li> 5.
                            <Space width={4} />
                            {i18n._('Add the image or text you need to engrave on the background and complete the settings based on your needs.')}
                        </li>
                        <img
                            style={{ width: '227px', height: '228px', display: 'block', margin: '4px auto' }}
                            src="images/laser/laser_camera-aid-bg-instructions-02.png"
                            role="presentation"
                            alt="x"
                        />
                        <li>
                            6.
                            <Space width={4} />
                            {i18n._('Click')}
                            <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Generate G-code')}</span>
                            {i18n._('and then')}
                            <span style={{ color: '#28a7e1', padding: '0 0 0 4px' }}>{i18n._('Load G-code to Workspace')}</span>
                            {'.'}
                        </li>
                        <li>
                            7.
                            <Space width={4} />
                            {i18n._('Set the work origin only on the Z direction again so that the printer can engrave on the surface of the material.')}
                            <Space width={4} />
                            {i18n._('Click')}
                            <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Z')}</span>
                            {'>'}
                            <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Zero Out Temporary Z Axis')}</span>
                            {i18n._('to save the new origin.')}
                        </li>
                        <img
                            style={{ width: '266px', height: '86px', display: 'block', margin: '4px auto' }}
                            src="images/laser/laser_camera-aid-bg-instructions-03.png"
                            role="presentation"
                            alt="x"
                        />
                        <p>{i18n._('Note: If you use the USB disk to engrave, please make sure you set the work origin in Snapmakerjs instead of on the touch screen.')}</p>
                        <li>
                            8.
                            <Space width={4} />
                            {i18n._('Set')}
                            <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Work Power')}</span>
                            {i18n._('and start the engraving.')}
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
