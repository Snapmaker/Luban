import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { Divider, Input } from 'antd';
import Cascader from '../../components/Cascader';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import {
    HEAD_PRINTING,
    LEFT_EXTRUDER,
    NOZZLE_SIZE_DEFAULT_OPTIONS,
    PRINTING_MANAGER_TYPE_EXTRUDER,
    PRINTING_MANAGER_TYPE_MATERIAL,
    RIGHT_EXTRUDER
} from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { getMaterialSelectOptions } from '../../utils/profileManager';

const plaMaterialId = 'material.pla';

function Material({ widgetActions }) {
    const materialDefinitions = useSelector(
        (state) => state?.printing?.materialDefinitions
    );
    const defaultMaterialId = useSelector(
        (state) => state?.printing?.defaultMaterialId,
        shallowEqual
    );
    const defaultMaterialIdRight = useSelector(
        (state) => state?.printing?.defaultMaterialIdRight,
        shallowEqual
    );
    const extruderLDefinition = useSelector(
        (state) => state?.printing?.extruderLDefinition
    );
    const extruderRDefinition = useSelector(
        (state) => state?.printing?.extruderRDefinition
    );
    const leftDiameter = useSelector(
        (state) => state?.printing?.extruderLDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );
    const rightDiameter = useSelector(
        (state) => state?.printing?.extruderRDefinition?.settings?.machine_nozzle_size
            ?.default_value
    );
    const printingToolhead = useSelector(
        (state) => state?.machine?.toolHead?.printingToolhead
    );
    const inProgress = useSelector((state) => state?.printing?.inProgress);
    const dispatch = useDispatch();

    function onShowPrintingManager(direction = LEFT_EXTRUDER) {
        dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
        dispatch(printingActions.updateShowPrintingManager(true, direction));
    }

    const updateActiveDefinition = useCallback(
        (definitionModel, managerDisplayType, direction) => {
            if (definitionModel) {
                dispatch(
                    printingActions.updateCurrentDefinition({
                        definitionModel,
                        managerDisplayType,
                        direction
                    })
                );
                dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
            }
        },
        [dispatch]
    );

    function onChangeMaterialValue(option, direction) {
        const definitionId = option.definitionId;
        const definition = materialDefinitions.find(
            (d) => d.definitionId === definitionId
        );
        if (definition) {
            // update selectedId
            dispatch(
                printingActions.updateDefaultMaterialId(
                    definition.definitionId,
                    direction
                )
            );
            // dispatch(printingActions.updateExtruderDefinition(definition, direction));

            // on after changes
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        }
    }

    useEffect(() => {
        widgetActions.setTitle(
            i18n._('key-Printing/PrintingConfigurations-Extruder')
        );
    }, [widgetActions]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === defaultMaterialId
        );
        if (!definition) {
            dispatch(printingActions.updateDefaultMaterialId(plaMaterialId));
        }
        updateActiveDefinition(definition, PRINTING_MANAGER_TYPE_MATERIAL);
    }, [defaultMaterialId]);

    const materialDefinitionOptions = getMaterialSelectOptions(
        materialDefinitions
    );
    const valueObj = {
        firstKey: 'definitionId',
        firstValue: defaultMaterialId
    };
    const valueObjForRight = {
        firstKey: 'definitionId',
        firstValue: defaultMaterialIdRight
    };

    function setDiameter(direction, value) {
        const def = direction === LEFT_EXTRUDER
            ? extruderLDefinition
            : extruderRDefinition;
        def.settings.machine_nozzle_size.default_value = value;
        updateActiveDefinition(def, PRINTING_MANAGER_TYPE_EXTRUDER, direction);
        dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
    }

    const [diametersOptions, setDiametersOptions] = useState(
        NOZZLE_SIZE_DEFAULT_OPTIONS
    );
    useEffect(() => {
        if (
            leftDiameter
            && !diametersOptions.find((d) => d.value === leftDiameter)
        ) {
            diametersOptions.push({
                value: leftDiameter,
                label: leftDiameter
            });
        }
        if (
            isDualExtruder(printingToolhead)
            && rightDiameter
            && !diametersOptions.find((d) => d.value === rightDiameter)
        ) {
            diametersOptions.push({
                value: rightDiameter,
                label: rightDiameter
            });
        }
        setDiametersOptions(diametersOptions);
    }, [leftDiameter, rightDiameter]);

    const [selectorCustomValue, setSelectorCustomValue] = useState('');

    function dropdownRender(direction = LEFT_EXTRUDER) {
        return (menu) => (
            <div>
                {menu}
                <Divider style={{ margin: '0' }} />
                <div className="sm-flex height-36 padding-right-4 padding-bottom-4">
                    <Input
                        style={{
                            width: '152px'
                        }}
                        className="height-32"
                        placeholder={i18n._(
                            'key-Printing/PrintingConfigurations-Add Item'
                        )}
                        bordered={false}
                        value={selectorCustomValue}
                        onChange={(event) => {
                            setSelectorCustomValue(event.target.value);
                        }}
                    />
                    {selectorCustomValue !== '' && (
                        <SvgIcon
                            className="margin-top-2"
                            color="#1890FF"
                            name="CameraCaptureExtract"
                            onClick={() => {
                                const v = Number(selectorCustomValue);
                                if (Number.isNaN(v) || v < 0.1 || v > 1.75) {
                                    return;
                                }
                                if (
                                    !diametersOptions.find((d) => d.value === v)
                                ) {
                                    diametersOptions.push({
                                        value: v,
                                        label: v
                                    });
                                    setDiametersOptions(diametersOptions);
                                }
                                setDiameter(direction, v);
                                setSelectorCustomValue('');
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className={classNames('margin-top-8')}>
                <div className="sm-flex align-center justify-space-between">
                    <span className="display-inline color-black-3 width-112 text-overflow-ellipsis height-32">
                        {i18n._('Nozzle Diameter')}
                    </span>
                    <div>
                        <div className="display-inline">
                            {
                                isDualExtruder(printingToolhead) && (
                                    <span style={{ color: '#86868B' }}>L</span>
                                )
                            }
                            <Cascader
                                className={
                                    isDualExtruder(printingToolhead)
                                        ? 'margin-left-4 width-80'
                                        : 'margin-left-4 width-200'
                                }
                                dropdownRender={dropdownRender(LEFT_EXTRUDER)}
                                options={diametersOptions}
                                value={leftDiameter}
                                placement="bottomLeft"
                                onChange={(option) => {
                                    setDiameter(LEFT_EXTRUDER, option[0]);
                                }}
                            />
                        </div>
                        {
                            isDualExtruder(printingToolhead) && (
                                <div className="display-inline margin-left-16">
                                    <span style={{ color: '#86868B' }}>R</span>
                                    <Cascader
                                        className="margin-left-4 width-80"
                                        dropdownRender={dropdownRender(
                                            RIGHT_EXTRUDER
                                        )}
                                        options={diametersOptions}
                                        placement="bottomRight"
                                        value={rightDiameter}
                                        onChange={(option) => {
                                            setDiameter(RIGHT_EXTRUDER, option[0]);
                                        }}
                                    />
                                </div>
                            )
                        }
                    </div>
                </div>
                <div className="sm-flex align-center color-black-3 justify-space-between margin-top-8">
                    <span className="display-inline width-88 text-overflow-ellipsis">
                        {isDualExtruder(printingToolhead)
                            ? i18n._(
                                'key-Printing/PrintingConfigurations-Extruder L'
                            )
                            : i18n._('key-Laser/ToolpathParameters-Material')}
                    </span>
                    <div>
                        <Select
                            clearable={false}
                            size="160px"
                            isGroup
                            valueObj={valueObj}
                            options={materialDefinitionOptions}
                            value={defaultMaterialId}
                            onChange={(option) => onChangeMaterialValue(option, LEFT_EXTRUDER)}
                            disabled={inProgress}
                        />
                        <SvgIcon
                            className="border-default-black-5 margin-left-8"
                            name="PrintingSettingNormal"
                            size={24}
                            disabled={inProgress}
                            onClick={() => onShowPrintingManager(LEFT_EXTRUDER)}
                            borderRadius={8}
                        />
                    </div>
                </div>
                {isDualExtruder(printingToolhead) && (
                    <div className="sm-flex align-center color-black-3 justify-space-between margin-top-8">
                        <span className="display-inline width-88 text-overflow-ellipsis height-32">
                            {i18n._(
                                'key-Printing/PrintingConfigurations-Extruder R'
                            )}
                        </span>
                        <div>
                            <Select
                                clearable={false}
                                size="160px"
                                isGroup
                                valueObj={valueObjForRight}
                                options={materialDefinitionOptions}
                                value={defaultMaterialIdRight}
                                onChange={(option) => onChangeMaterialValue(
                                    option,
                                    RIGHT_EXTRUDER
                                )}
                                disabled={inProgress}
                            />
                            <SvgIcon
                                className="border-default-black-5 margin-left-8"
                                name="PrintingSettingNormal"
                                size={24}
                                disabled={inProgress}
                                onClick={() => onShowPrintingManager(RIGHT_EXTRUDER)}
                                borderRadius={8}
                            />
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
}

Material.propTypes = {
    widgetActions: PropTypes.object
};

export default Material;
