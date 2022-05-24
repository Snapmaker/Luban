import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Radio } from '../../components/Radio';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';


const arry = [
    {
        name: '自动测距（Auto Mode）',
        show: {
            // mean: 'true' will show only can rotate status, false will only show no rotate status , undefined will show not matter what roate is
            isRotate: true,
            isHeightPower: true,
            isSerialConnect: true,
        },
        disable: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
        },
    },
    {
        name: '输入材料厚度',
        show: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
        },
        disable: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
        }
    },
    {
        name: '按机器设置原点（Manual Mode）',
        show: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
        },
        disable: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
        }
    },

];


function LaserStartModal(props) {
    const {
        showStartModal,
        isHeightPower,
        isSerialConnect,
        isRotate
    } = props;
    const [selectedValue, setSelectedValue] = useState(0);

    const onChange = (event) => {
        setSelectedValue(event.target.value);
    };


    const handlerAxis = (value) => {
        return typeof value.isRotate === 'undefined' || value.isRotate === isRotate;
    };

    const handlerPowerLevel = (value) => {
        return typeof value.isHeightPower === 'undefined' || value.isHeightPower === isHeightPower;
    };

    const handlerConnect = (value) => {
        return typeof value.isSerialConnect === 'undefined' || value.isSerialConnect === isSerialConnect;
    };

    console.log(showStartModal, isHeightPower, isRotate);


    return (
        <Modal
            centered
            visible={showStartModal}
            onClose={() => { props.onClose(); }}
        >
            <Modal.Header>
                {i18n._('key-Workspace/LaserStartJob-start_job')}
            </Modal.Header>
            <Modal.Body>
                <Radio.Group
                    style={{ display: 'flex', flexDirection: 'column' }}
                    onChange={onChange}
                    value={selectedValue}
                >
                    {arry.map(v => {
                        console.log(v);
                        return (
                            <Radio
                                style={{ borderRadius: '100%' }}
                                className="sm-flex-auto margin-top-16"
                                value={v.name}
                                disabled={handlerAxis(v.dispable) && handlerPowerLevel(v.dispable) && handlerConnect(v.dispable)}
                                // checked={isLaserPrintAutoMode}
                                // onChange={actions.onChangeLaserPrintMode}
                            >
                                <span> { v.name } {i18n._('key-Workspace/LaserStartJob-3axis_start_job_auto_mode')} </span>
                                {v.name === selectedValue && (
                                    <span>

                                    sdafsdafasfsadfsadfasfsad
                                    </span>
                                )}
                            </Radio>
                        );
                    })}
                </Radio.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button priority="level-three" width="88px" onClick={() => props.onClose()} className="margin-right-16">{i18n._('key-unused-Cancel')}</Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="88px"
                    onClick={() => { props.onConfirm(); props.onClose(); }}
                >
                    {i18n._('key-Workspace/LaserStartJob-button_start')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}


LaserStartModal.propTypes = {
    showStartModal: PropTypes.bool.isRequired,
    isHeightPower: PropTypes.bool.isRequired,
    isRotate: PropTypes.bool.isRequired,
    isSerialConnect: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};
export default LaserStartModal;
