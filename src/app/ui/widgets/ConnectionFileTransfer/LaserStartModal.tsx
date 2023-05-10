import { Tooltip } from 'antd';
import { isString, isUndefined } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { AUTO_MDOE, MANUAL_MODE, SEMI_AUTO_MODE } from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Modal from '../../components/Modal';
import { Radio } from '../../components/Radio';

function LaserStartModal({
    showStartModal,
    isHeightPower,
    isSerialConnect,
    isRotate,
    onClose,
    onConfirm
}) {
    const [selectedValue, setSelectedValue] = useState(MANUAL_MODE);
    const { size } = useSelector(state => state?.machine);
    const { materialThickness } = useSelector(state => state?.workspace);
    const dispatch = useDispatch();

    useEffect(() => {
        if (isSerialConnect) {
            setSelectedValue(isRotate ? MANUAL_MODE : SEMI_AUTO_MODE);
        } else {
            if (isHeightPower) {
                setSelectedValue(isRotate ? MANUAL_MODE : AUTO_MDOE);
            } else {
                setSelectedValue(isRotate ? MANUAL_MODE : SEMI_AUTO_MODE);
            }
        }
    }, [isSerialConnect, isRotate, isHeightPower]);

    const onChange = (event) => {
        setSelectedValue(event.target.value);
        if (event.target.value === SEMI_AUTO_MODE) {
            dispatch(workspaceActions.updateMaterialThickness(1.5));
        }
    };

    const handlerAxis = (value) => {
        const { isRotate: _isRotate } = value;
        return isUndefined(_isRotate) || _isRotate === isRotate;
    };
    const handlerPowerLevel = (value) => {
        const { isHeightPower: _isHeightPower } = value;
        return isUndefined(_isHeightPower) || _isHeightPower === isHeightPower;
    };
    const handlerConnect = (value) => {
        const { isSerialConnect: _isSerialConnect } = value;
        return isUndefined(_isSerialConnect) || _isSerialConnect === isSerialConnect;
    };

    const handleDisplay = v => v.display && handlerAxis(v.display) && handlerPowerLevel(v.display) && handlerConnect(v.display);
    const handleDisable = v => {
        let disabled = false;
        switch (v.key) {
            case AUTO_MDOE:
                disabled = isSerialConnect;
                break;
            case SEMI_AUTO_MODE:
                disabled = isRotate;
                break;
            default:
                disabled = false;
                break;
        }
        return disabled;
    };

    const onChangeMaterialThickness = (value) => {
        // safety setting
        value = value < 0 ? 0 : value;
        dispatch(workspaceActions.updateMaterialThickness(value));
    };
    useEffect(() => {
        onChangeMaterialThickness(materialThickness);
    }, []);


    // i18n._('')
    // const { AUTO_MDOE, SEMI_AUTO_MODE, MANUAL_MODE } = LaserLevelingMode;
    const arry = [
        {
            key: AUTO_MDOE,
            name: i18n._('key-Workspace/LaserStartJob-auto_mode'),
            description: i18n._('key-Workspace/LaserStartJob-auto_mode_description'),
            display: {
                // mean: 'true' will show only can rotate status, false will only show no rotate status , undefined will show not matter what roate is
                isRotate: false,
                isHeightPower: true,
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
            display: {},
            disable: {
                isRotate: true,
                // isHeightPower: true,
                isSerialConnect: false,
            }
        },
        {
            key: MANUAL_MODE,
            name: i18n._('key-Workspace/LaserStartJob-manual_mode'),
            description: () => (
                <Trans i18nKey="key-Workspace/LaserStartJob-manual_mode_description">
                    In <b>Manually control</b> the movement of the execution head until the laser beam converges into the smallest spot on the surface of
                    the material. Click to <b>start the job</b>, the machine will use the current height as the laser height.
                </Trans>
            ),
            display: {},
            disable: false
        },

    ];

    const goWork = () => {
        onConfirm(selectedValue);
        onClose();
    };

    return (
        <Modal
            centered
            open={showStartModal}
            onClose={onClose}
            style={{ width: '50%' }}
            width="40%"
        >
            <Modal.Header>
                {i18n._('key-Workspace/LaserStartJob-Select Mode')}
            </Modal.Header>
            <Modal.Body>
                <Radio.Group
                    style={{ display: 'flex', flexDirection: 'column' }}
                    onChange={onChange}
                    value={selectedValue}
                >
                    {arry.map(v => {
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
                                    <span className={(handleDisable(v) ? 'heading-3 color-black-5' : 'heading-3')}> {v.name}</span>
                                </Tooltip>
                                {v.key === selectedValue && (<div className=" margin-top-8">{isString(v.description) ? v.description : v.description()} </div>)}
                            </Radio>
                        );
                    })}
                </Radio.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button priority="level-three" width="88px" onClick={onClose} className="margin-right-16">{i18n._('key-unused-Cancel')}</Button>
                <Button
                    priority="level-two"
                    type="primary"
                    width="88px"
                    onClick={goWork}
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
