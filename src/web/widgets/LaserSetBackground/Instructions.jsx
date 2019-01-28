import React from 'react';
import PropTypes from 'prop-types';
import Space from '../../components/Space/Space';
import Modal from '../../components/Modal';
import i18n from '../../lib/i18n';
import styles from './styles.styl';

const Instructions = (actions) => {
    return (
        <Modal style={{ width: '1080px' }} size="lg" onClose={actions.hideInstructions}>
            <Modal.Header>
                <Modal.Title>
                    {i18n._('How Fine Tune Work Origin Works')}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className={styles['test-laser-instruction-content']}>
                <p>{i18n._('Setting work origin is essentially finding the best place for the engraved image \
in the X and Y directions and determining the distance (Z Offset) between the Engraving & Carving Platform and the \
Laser Module to acquire the smallest laser dot on the material for the most efficient use of the laser power and the \
best result. For the 200mW Laser Engraving Module, the Z Offset can be set by judging the size of the laser dot by eyes \
with low power. However, for the 1600mW Laser Cutting Module, this method is less accurate as the laser dot is too \
strong and less interpretable. To set the Z Offset more accurately, we can move the module to the position that is \
close to the optimal Z Offset (Offset A). The software will test the results from a few positions next to Offset A \
on the same material. The best result determines the best Z Offset.')}
                </p>
                <div className={styles['test-laser-instruction-step']}>
                    <img
                        src="images/laser/laser-test-instructions-01.png"
                        role="presentation"
                        alt="x"
                    />
                    <p>
                        <span>{i18n._('Click')}</span>
                        <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Focus')}</span>
                        <span>{i18n._('and use')}</span>
                        <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Jog Pad')}</span>
                        <span>{i18n._('in the Axes section to move the Laser Cutting Module to the position \
that is close to the optimal Z Offset (just like how you do with the 200mW Laser Engraving Module).')}
                        </span>
                    </p>
                </div>
                <div className={styles['test-laser-instruction-step']}>
                    <img
                        src="images/laser/laser-test-instructions-02.png"
                        role="presentation"
                        alt="x"
                    />
                    <p>
                        <span>{i18n._('Set Work Speed and Power based on the material you are using. If you are using \
a piece of 1.5 mm wood sheet, it’s recommended to set the Work Speed to a value between 80 mm/s and 120 mm/s and set the Power to 100%.')}
                        </span>
                        <Space width={4} />
                        <span>{i18n._('Click')}</span>
                        <span style={{ color: '#28a7e1', padding: '0 4px' }}>{i18n._('Generate and Load G-code')}</span>
                        <span>{i18n._('and the G-code is automatically generated and loaded.')}</span>
                    </p>
                </div>
                <div className={styles['test-laser-instruction-step']}>
                    <img
                        src="images/laser/laser-test-instructions-03.png"
                        role="presentation"
                        alt="x"
                    />
                    <p>
                        <span>{i18n._('Click')}</span>
                        <span className="fa fa-play" style={{ padding: '0 4px' }} />
                        <span>{i18n._('to start laser cutting.')}</span>
                        <Space width={4} />
                        <span>{i18n._('Choose the position that can cut the material the most smoothly or \
engrave the thinnest line and the software will set it as Z Offset. In this example, -2.0 should be the Z Offset.')}
                        </span>
                    </p>
                </div>
            </Modal.Body>
        </Modal>
    );
};

Instructions.propTypes = {
    actions: PropTypes.object.isRequired
};

export default Instructions;
