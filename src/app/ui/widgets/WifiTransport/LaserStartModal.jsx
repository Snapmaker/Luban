import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import { Radio } from '../../components/Radio';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import i18n from '../../../lib/i18n';
import { actions as machineActions } from '../../../flux/machine';
import LaserLevelingMode from './LaserLevelingMode';



function LaserStartModal(props) {
    const {
        showStartModal,
        isHeightPower,
        isSerialConnect,
        isRotate
    } = props;
    const [selectedValue, setSelectedValue] = useState(0);
    const { size, materialThickness } = useSelector(state => state?.machine);
    const dispatch = useDispatch();

    const onChange = (event) => {
        setSelectedValue(event.target.value);
    };


    const handlerAxis = value => typeof value.isRotate === 'undefined' || value.isRotate === isRotate;
    const handlerPowerLevel = value => typeof value.isHeightPower === 'undefined' || value.isHeightPower === isHeightPower;
    const handlerConnect = value => typeof value.isSerialConnect === 'undefined' || value.isSerialConnect === isSerialConnect;
    const handleDisable = v => v.disable && handlerAxis(v.disable) && handlerPowerLevel(v.disable) && handlerConnect(v.disable);
    const handleDisplay = v => v.display && handlerAxis(v.display) && handlerPowerLevel(v.display) && handlerConnect(v.display);

    const onChangeMaterialThickness = (value) => {
        if (value < 0) {
            // safely setting
            value = 0;
        }
        dispatch(machineActions.updateMaterialThickness(value));
    };


    // i18n._('')
    const { AUTO_MDOE, SEMI_AUTO_MODE, MANUAL_MODE } = LaserLevelingMode;
    const arry = [
        {
            key: AUTO_MDOE,
            name: i18n._('key-Workspace/LaserStartJob-auto_mode'),
            description: i18n._('key-Workspace/LaserStartJob-auto_mode_description'),
            display: {
            // mean: 'true' will show only can rotate status, false will only show no rotate status , undefined will show not matter what roate is
            // isRotate: true,
                isHeightPower: true,
                isSerialConnect: false,
            },
            disable: {
                isRotate: true,
                // isHeightPower: true,
                isSerialConnect: true,
            },
        },
        {
            key: SEMI_AUTO_MODE,
            name: i18n._('key-Workspace/LaserStartJob-semi_auto_mode'),
            description: () => (
                <div className="">
                    <div> {i18n._('key-Workspace/LaserStartJob-semi_auto_mode_description')}</div>
                    <div className="sm-flex align-center margin-top-8">
                        <span className="">{i18n._('key-Workspace/LaserStartJob-3axis_start_job_material_thickness')}</span>
                        <Input
                            suffix="mm"
                            className="margin-left-16"
                            size="small"
                            value={materialThickness}
                            max={size.z - 40}
                            min={0}
                            onChange={onChangeMaterialThickness}
                        />
                    </div>
                </div>
            ),
            display: {
            // isRotate: true,
            // isHeightPower: false,
            // isSerialConnect: true,
            },
            disable: {
                isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
            }
        },
        {
            key: MANUAL_MODE,
            name: i18n._('key-Workspace/LaserStartJob-manual_mode'),
            description: i18n._('key-Workspace/LaserStartJob-manual_mode_description'),
            display: {
            // isRotate: true,
            // isHeightPower: true,
            // isSerialConnect: true,
            },
            disable: false
        },

    ];




    return (
        <Modal
            centered
            visible={showStartModal}
            onClose={() => { props.onClose(); }}
            style={{ width: '50%' }}
            width="40%"
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
                        // console.log(v);
                        return handleDisplay(v) && (
                            <Radio
                                key={`laserStartModal${v.name}`}
                                style={{ borderRadius: '100%', marginTop: '16px' }}
                                className="sm-flex-auto "
                                value={v.key}
                                disabled={handleDisable(v)}
                                // checked={isLaserPrintAutoMode}
                                // onChange={actions.onChangeLaserPrintMode}
                            >
                                <Tooltip
                                    placement="right"
                                    title={handleDisable(v) && (<span>{i18n._('key-Workspace/LaserStartJob-Disable reason')}</span>)}
                                >
                                    <span className={handleDisable(v) ? 'heading-3 color-black-5' : 'heading-3'}> { v.name }</span>
                                </Tooltip>
                                {v.key === selectedValue && (<div className=" margin-top-8">{typeof v.description === 'string' ? v.description : v.description()} </div>)}
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
                    onClick={() => { props.onConfirm(selectedValue,); props.onClose(); }}
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
