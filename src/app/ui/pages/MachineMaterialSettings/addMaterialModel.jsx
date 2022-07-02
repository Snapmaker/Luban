import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Popover } from 'antd';
import i18n from '../../../lib/i18n';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import { TextInput as Input } from '../../components/Input';
import ColorSelector from '../../components/ColorSelector';
import Checkbox from '../../components/Checkbox';
import { PRINTING_MATERIAL_CONFIG_COLORS } from '../../../constants';
import { Button } from '../../components/Buttons';

const materialTypeOptions = [{
    value: 'PLA',
    label: 'PLA'
}, {
    value: 'ABS',
    label: 'ABS'
}, {
    value: 'PETG',
    label: 'PETG'
}];

const AddMaterialModel = ({
    setShowCreateMaterialModal
}) => {
    const [materialType, setMaterialType] = useState('PLA');
    const [materialName, setMaterialName] = useState('');
    const [materialColor, setMaterialColor] = useState('#ffffff');
    const [showColor, setShowColor] = useState(false);
    const [printingTemperatureUp, setPrintingTemperatureUp] = useState(null);
    const [printingTemperatureDown, setPrintingTemperatureDown] = useState(null);
    const [buildPlateTemperatureDown, setBuildPlateTemperatureDown] = useState(null);
    const [buildPlateTemperatureUp, setBuildPlateTemperatureUp] = useState(null);
    const [openFan, setOpenFan] = useState(true);
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
                        <img src="/resources/images/machine/size-2.0-A150.png" alt="" className="width-percent-100 height-percent-100" />
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
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Material Name')}</span>
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
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Printing Temperature')}</span>
                            <div className="sm-flex align-center">
                                <Input
                                    value={printingTemperatureDown}
                                    onChange={(e) => setPrintingTemperatureDown(e.target.value)}
                                    size="small-level-one"
                                    suffix="°C"
                                />
                                <span className="margin-horizontal-8 width-16 border-bottom-black-5" />
                                <Input
                                    value={printingTemperatureUp}
                                    onChange={(e) => setPrintingTemperatureUp(e.target.value)}
                                    size="small-level-one"
                                    suffix="°C"
                                />
                            </div>
                        </div>
                        <div className="sm-flex justify-space-between align-center margin-bottom-8">
                            <span className="width-160 display-inline text-overflow-ellipsis">{i18n._('key-profileManager/Build plate Temperature')}</span>
                            <div className="sm-flex align-center">
                                <Input
                                    value={buildPlateTemperatureDown}
                                    onChange={(e) => setBuildPlateTemperatureDown(e.target.value)}
                                    size="small-level-one"
                                    suffix="°C"
                                />
                                <span className="margin-horizontal-8 width-16 border-bottom-black-5" />
                                <Input
                                    value={buildPlateTemperatureUp}
                                    onChange={(e) => setBuildPlateTemperatureUp(e.target.value)}
                                    size="small-level-one"
                                    suffix="°C"
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
                    >
                        {i18n._('key-Modal/Common-Cancel')}
                    </Button>
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        type="primary"
                    >
                        {i18n._('key-Modal/Common-OK')}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

AddMaterialModel.propTypes = {
    setShowCreateMaterialModal: PropTypes.func
};

export default AddMaterialModel;
