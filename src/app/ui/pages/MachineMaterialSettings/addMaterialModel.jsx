import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { isNull } from 'lodash';
import Popover from '../../components/Popover';
import i18n from '../../../lib/i18n';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import { TextInput as Input, NumberInput as NInput } from '../../components/Input';
import ColorSelector from '../../components/ColorSelector';
import Checkbox from '../../components/Checkbox';
import { PRINTING_MATERIAL_CONFIG_COLORS, BLACK_COLOR } from '../../../constants';
import { Button } from '../../components/Buttons';

const materialTypeOptions = [
    {
        value: 'PLA',
        label: 'PLA'
    },
    {
        value: 'Support',
        label: 'Support'
    },
    {
        value: 'ABS',
        label: 'ABS'
    },
    {
        value: 'PETG',
        label: 'PETG'
    },
    {
        value: 'TPE',
        label: 'TPE'
    },
    {
        value: 'TPU',
        label: 'TPU'
    },
    {
        value: 'PVA',
        label: 'PVA'
    },
    {
        value: 'ASA',
        label: 'ASA'
    },
    {
        value: 'PC',
        label: 'PC'
    },
    {
        value: 'Nylon',
        label: 'Nylon'
    },
    {
        value: 'Other',
        label: 'Other'
    }
];

const AddMaterialModel = ({
    setShowCreateMaterialModal,
    onSubmit
}) => {
    const [materialType, setMaterialType] = useState('PLA');
    const [materialName, setMaterialName] = useState('');
    const [materialColor, setMaterialColor] = useState(BLACK_COLOR);
    const [showColor, setShowColor] = useState(false);
    const [printingTemperatureUp, setPrintingTemperatureUp] = useState(null);
    const [printingTemperatureDown, setPrintingTemperatureDown] = useState(null);
    const [buildPlateTemperatureDown, setBuildPlateTemperatureDown] = useState(null);
    const [buildPlateTemperatureUp, setBuildPlateTemperatureUp] = useState(null);
    const [openFan, setOpenFan] = useState(false);
    return (
        <Modal
            onClose={() => setShowCreateMaterialModal(false)}
            style={{ minWidth: '664px' }}
        >
            <Modal.Header>
                <div>{i18n._('key-profileManager/Create Material')}</div>
            </Modal.Header>
            <Modal.Body>
                <div>
                    {i18n._('key-profileManager/Create Material tip-1')}
                </div>
                <div className="sm-flex">
                    <div className="width-232 height-232 margin-right-24">
                        <img src="/resources/images/3dp/pic_material_label.png" alt="" className="width-percent-100 height-percent-100" />
                    </div>
                    <div className="width-360">
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Material Type')}</span>
                            <Select
                                size="large"
                                options={materialTypeOptions}
                                value={materialType}
                                onChange={(e) => setMaterialType(e.value)}
                            />
                        </div>
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Material Name')}<span className="color-red-1">*</span></span>
                            <Input
                                value={materialName}
                                onChange={(e) => setMaterialName(e.target.value)}
                                placeholder="Material Name"
                                size="large"
                            />
                        </div>
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Material Color')}</span>
                            <div>
                                <Popover
                                    content={() => (
                                        <ColorSelector
                                            colors={PRINTING_MATERIAL_CONFIG_COLORS}
                                            value={materialColor}
                                            onClose={() => setShowColor(false)}
                                            onChangeComplete={(color) => setMaterialColor(color)}
                                        />
                                    )}
                                    trigger="click"
                                    placement="bottomRight"
                                    visible={showColor}
                                    className="cancel-content-padding"
                                    onVisibleChange={(visible) => {
                                        setShowColor(visible);
                                    }}
                                >
                                    <span
                                        className="sm-flex-width align-r height-percent-100 width-96 display-inline border-radius-8 border-default-black-5"
                                        style={{
                                            background: materialColor,
                                            height: 32
                                        }}
                                        role="button"
                                        tabIndex="-1"
                                        onKeyPress={() => {}}
                                        onClick={() => setShowColor(!showColor)}
                                    />
                                </Popover>
                            </div>
                        </div>
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Printing Temperature')}<span className="color-red-1">*</span></span>
                            <div className="sm-flex align-center">
                                <NInput
                                    value={printingTemperatureDown}
                                    onChange={(value) => setPrintingTemperatureDown(value)}
                                    size="small-level-one"
                                    suffix="°C"
                                    min={0}
                                />
                                <span className="margin-horizontal-8 width-16 border-bottom-black-5" />
                                <NInput
                                    value={printingTemperatureUp}
                                    onChange={(value) => setPrintingTemperatureUp(value)}
                                    size="small-level-one"
                                    suffix="°C"
                                    min={printingTemperatureDown || 1}
                                />
                            </div>
                        </div>
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Build plate Temperature')}<span className="color-red-1">*</span></span>
                            <div className="sm-flex align-center">
                                <NInput
                                    value={buildPlateTemperatureDown}
                                    onChange={(value) => { setBuildPlateTemperatureDown(value); }}
                                    size="small-level-one"
                                    suffix="°C"
                                    min={0}
                                />
                                <span className="margin-horizontal-8 width-16 border-bottom-black-5" />
                                <NInput
                                    value={buildPlateTemperatureUp}
                                    onChange={(value) => setBuildPlateTemperatureUp(value)}
                                    size="small-level-one"
                                    suffix="°C"
                                    min={buildPlateTemperatureDown || 1}
                                />
                            </div>
                        </div>
                        <div className="sm-flex justify-space-between align-center">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Fan')}</span>
                            <Checkbox
                                checked={openFan}
                                onChange={e => setOpenFan(e.target.checked)}
                            />
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        type="default"
                        onClick={() => setShowCreateMaterialModal(false)}
                    >
                        {i18n._('key-Modal/Common-Cancel')}
                    </Button>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        type="primary"
                        disabled={!materialName || isNull(printingTemperatureDown) || isNull(printingTemperatureUp) || isNull(buildPlateTemperatureDown) || isNull(buildPlateTemperatureUp)}
                        onClick={() => onSubmit({
                            type: materialType,
                            color: materialColor,
                            name: materialName,
                            printingTemperature: printingTemperatureUp || printingTemperatureDown,
                            buildPlateTemperature: buildPlateTemperatureUp || buildPlateTemperatureDown,
                            openFan: openFan
                        })}
                    >
                        {i18n._('key-Modal/Common-OK')}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

AddMaterialModel.propTypes = {
    setShowCreateMaterialModal: PropTypes.func,
    onSubmit: PropTypes.func
};

export default AddMaterialModel;
