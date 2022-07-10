import { find, includes, filter, cloneDeep } from 'lodash';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CaretRightOutlined } from '@ant-design/icons';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { message, Tooltip } from 'antd';
import Popover from '../../components/Popover';
import { actions as printingActions } from '../../../flux/printing';
import { useGetDefinitions } from '../../views/ProfileManager';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { LEFT, RIGHT } from '../../../../server/constants';
import { Button } from '../../components/Buttons';
import AddMaterialModel from './addMaterialModel';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_MATERIAL, RIGHT_EXTRUDER } from '../../../constants';
import PrintingManager from '../../views/PrintingManager';
import { machineStore } from '../../../store/local-storage';
import SvgIcon from '../../components/SvgIcon';
import modal from '../../../lib/modal';
import styles from './styles.styl';

const MaterialSettings = ({
    toolHead
}) => {
    const materialActiveCategory = machineStore.get('settings.materialActiveCategory');
    const { defaultMaterialId, defaultMaterialIdRight, materialDefinitions, materialManagerDirection } = useSelector(state => state.printing);
    const [leftMaterialDefinitionId, setLeftMaterialDefinitionId] = useState(defaultMaterialId);
    const [leftMaterialDefinition, setLeftMaterialDefinition] = useState(find(materialDefinitions, { definitionId: leftMaterialDefinitionId }));
    const [rightMaterialDefinitionId, setRightMaterialDefinitionId] = useState(defaultMaterialIdRight);
    const [rightMaterialDefinition, setRightMaterialDefinition] = useState(find(materialDefinitions, { definitionId: rightMaterialDefinitionId }));
    const [definitionByCategory, setDefinitionByCategory] = useState({});
    const [activeCategory, setActiveCategory] = useState(materialActiveCategory?.split('&') || ['PLA']);
    const [activeNozzle, setActiveNozzle] = useState(LEFT);
    const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false);
    const fileInput = useRef(null);
    const currentDefinitions = useRef(materialDefinitions);
    currentDefinitions.current = materialDefinitions;
    const dispatch = useDispatch();
    const getDefaultDefinition = (definitionId) => {
        return dispatch(printingActions.getDefaultDefinition(definitionId));
    };
    const [definitionState, setDefinitionState] = useGetDefinitions(
        materialDefinitions,
        materialManagerDirection === LEFT ? defaultMaterialId : defaultMaterialIdRight,
        getDefaultDefinition,
        PRINTING_MANAGER_TYPE_MATERIAL
    );
    useEffect(() => {
        setLeftMaterialDefinition(find(materialDefinitions, { definitionId: leftMaterialDefinitionId }));
        setRightMaterialDefinition(find(materialDefinitions, { definitionId: rightMaterialDefinitionId }));
    }, [materialDefinitions, leftMaterialDefinitionId, rightMaterialDefinitionId]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === leftMaterialDefinitionId
        );
        dispatch(
            printingActions.updateDefaultMaterialId(
                definition.definitionId,
                LEFT_EXTRUDER
            )
        );
    }, [leftMaterialDefinitionId]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === rightMaterialDefinitionId
        );
        dispatch(
            printingActions.updateDefaultMaterialId(
                definition.definitionId,
                RIGHT_EXTRUDER
            )
        );
    }, [rightMaterialDefinitionId]);
    useEffect(() => {
        const definitionByCategoryTemp = {};
        materialDefinitions.forEach((definition) => {
            if (definitionByCategoryTemp[definition.category]) {
                definitionByCategoryTemp[definition.category].push(definition);
            } else {
                definitionByCategoryTemp[definition.category] = [definition];
            }
        });
        setDefinitionByCategory(definitionByCategoryTemp);
    }, [materialDefinitions]);

    const handleUpdateDefinition = (e, id) => {
        e.stopPropagation();
        if (activeNozzle === LEFT) {
            setLeftMaterialDefinitionId(id);
        } else {
            setRightMaterialDefinitionId(id);
        }
    };
    const onShowPrintingManager = () => {
        dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
        dispatch(printingActions.updateShowPrintingManager(true, activeNozzle));
    };
    const onUpdateCategory = (key) => {
        let newActiveCategory = activeCategory;
        if (includes(activeCategory, key)) {
            newActiveCategory = filter(activeCategory, (arr) => {
                return arr !== key;
            });
        } else {
            newActiveCategory = [...activeCategory, key];
        }
        setActiveCategory(newActiveCategory);
        machineStore.set('settings.materialActiveCategory', newActiveCategory.join('&'));
    };
    const handleDeleteMaterial = (e, definition) => {
        e.stopPropagation();
        if (definition.isDefault) return;
        const deleteName = definition.name;
        const popupActions = modal({
            title: i18n._('key-Printing/ProfileManager-Delete Profile'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-ProfileManager-Are you sure to delete profile "{{name}}"?', { name: deleteName })}</p>
                </React.Fragment>
            ),

            footer: (
                <Button
                    priority="level-two"
                    className="margin-left-8"
                    width="96px"
                    onClick={async () => {
                        await dispatch(printingActions.removeDefinitionByType(
                            PRINTING_MANAGER_TYPE_MATERIAL,
                            definition
                        ));
                        popupActions.close();
                    }}
                >
                    {i18n._('key-Printing/ProfileManager-Delete')}
                </Button>
            )
        });
    };
    const renderMaterialMore = (definition) => {
        return (
            <div>
                <Anchor className="display-block" onClick={onShowPrintingManager}>{i18n._('key-machineMaterialSettings/Profile update')}</Anchor>
                {!definition?.isDefault && (<Anchor className="display-block" onClick={e => handleDeleteMaterial(e, definition)}>{i18n._('key-App/Menu-Delete')}</Anchor>)}
            </div>
        );
    };
    const importFile = (ref) => {
        ref.current.value = null;
        ref.current.click();
    };

    const handleAddMaterial = async (data) => {
        const newDefinitionForManager = cloneDeep(definitionState.definitionForManager);
        newDefinitionForManager.category = data.type;
        newDefinitionForManager.i18nCategory = `key-default_category-${data.type.toUpperCase()}`;
        newDefinitionForManager.name = data.name;
        if (Object.keys(newDefinitionForManager.settings).length === 0) {
            newDefinitionForManager.settings = cloneDeep(materialDefinitions[0].settings);
        }
        newDefinitionForManager.settings = {
            ...newDefinitionForManager.settings,
            color: {
                default_value: data.color
            },
            material_print_temperature: {
                default_value: data.printingTemperature
            },
            cool_fan_speed: {
                default_value: data.openFan ? 100 : 0
            },
            material_bed_temperature: {
                default_value: data.buildPlateTemperature
            }
        };
        setShowCreateMaterialModal(false);
        const result = await dispatch(printingActions.duplicateDefinitionByType(
            PRINTING_MANAGER_TYPE_MATERIAL,
            newDefinitionForManager,
            undefined,
            data.name
        ));
        const selected = currentDefinitions.current.find(d => d.definitionId === result.definitionId);
        if (selected) {
            const selectedSettingDefaultValue = getDefaultDefinition(selected.definitionId);
            setDefinitionState({
                definitionForManager: selected,
                isCategorySelected: false,
                selectedName: selected.name,
                selectedSettingDefaultValue: selectedSettingDefaultValue
            });
            if (activeNozzle === LEFT) {
                setLeftMaterialDefinitionId(selected.definitionId);
            } else {
                setRightMaterialDefinitionId(selected.definitionId);
            }
        }
        message.info({
            content: <span>{i18n._('key-profileManager/Create Success')}<Anchor onClick={onShowPrintingManager}>{i18n._('key-profileManager/Open material profile')}</Anchor></span>,
            duration: 5
        });
    };
    // const onChangeFileForManager = (event) => {
    //     const file = event.target.files[0];
    //     return dispatch(
    //         printingActions.onUploadManagerDefinition(
    //             file,
    //             PRINTING_MANAGER_TYPE_MATERIAL
    //         )
    //     );
    // };
    // const onSelectDefinitionById = (definitionId, name) => {
    //     const definitionForManager
    // }
    const renderAddMaterial = () => {
        return (
            <div className="sm-flex">
                <Tooltip title={i18n._('key-Settings/Create Material Tips')}>
                    <Anchor className="sm-flex sm-flex-direction-c align-center width-112 height-88" onClick={() => setShowCreateMaterialModal(true)}>
                        <SvgIcon
                            name="TitleSetting"
                            size={48}
                            type={['hoverNormal', 'pressNormal']}
                        />
                        <span>{i18n._('key-Printing/ProfileManager-Create')}</span>
                    </Anchor>
                </Tooltip>
                <Anchor className="sm-flex sm-flex-direction-c width-112 height-88 align-center" onClick={() => importFile(fileInput)}>
                    <SvgIcon
                        name="TitleSetting"
                        size={48}
                        type={['hoverNormal', 'pressNormal']}
                    />
                    <span>{i18n._('key-Printing/ProfileManager-Import')}</span>
                </Anchor>
            </div>
        );
    };
    return (
        <div className="padding-vertical-40 padding-horizontal-40 height-all-minus-60 overflow-y-auto">
            <div className="sm-flex justify-space-between">
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    multiple={false}
                    // onChange={async (e) => {
                    //     const definition = await onChangeFileForManager(e);
                    //     onSelectDefinitionById(
                    //         definition.definitionId,
                    //         definition.name
                    //     );
                    // }}
                />
                <div className={`padding-horizontal-4 padding-vertical-4 border-radius-16 sm-flex background-grey-2 ${toolHead.printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 ? 'width-532' : 'width-272'}`}>
                    <Anchor onClick={() => setActiveNozzle(LEFT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-16 width-264 height-68 ${activeNozzle === LEFT ? 'background-color-white' : ''}`}>
                        <div className="heading-3">{i18n._('key-setting/Left-Nozzle')}</div>
                        <div className="sm-flex align-center margin-top-8">
                            <div className="height-16 width-16 border-default-grey-1 " style={{ background: `${leftMaterialDefinition?.settings?.color?.default_value}` }} />
                            <span className="margin-left-8">{i18n._(leftMaterialDefinition?.i18nName || leftMaterialDefinition?.name)}</span>
                        </div>
                    </Anchor>
                    {toolHead.printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                        <Anchor onClick={() => setActiveNozzle(RIGHT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-16 width-264 height-68 ${activeNozzle === RIGHT ? 'background-color-white' : ''}`}>
                            <div className="heading-3">{i18n._('key-setting/Right-Nozzle')}</div>
                            <div className="sm-flex align-center margin-top-8">
                                <div className="height-16 width-16 border-default-grey-1" style={{ background: `${rightMaterialDefinition?.settings?.color?.default_value}` }} />
                                <span className="margin-left-8">{i18n._(rightMaterialDefinition?.i18nName || rightMaterialDefinition?.name)}</span>
                            </div>
                        </Anchor>
                    )}
                </div>
                <div className="sm-flex">
                    <Button
                        priority="level-two"
                        width="160px"
                        type="default"
                        onClick={onShowPrintingManager}
                    >
                        <span className="display-inline width-142 text-overflow-ellipsis">{i18n._('key-settings/Profile Manager')}</span>
                    </Button>
                    <Popover
                        trigger="click"
                        content={renderAddMaterial}
                    >
                        <Button
                            priority="level-two"
                            width="160px"
                            className="margin-left-16"
                            // onClick={() => setShowCreateMaterialModal(true)}
                        >
                            <span className="display-inline width-142 text-overflow-ellipsis">{i18n._('key-settings/Add Material')}</span>
                        </Button>
                    </Popover>

                </div>
            </div>
            <div>
                {Object.keys(definitionByCategory).map(key => {
                    return (
                        <Anchor onClick={() => onUpdateCategory(key)} className="margin-top-36 display-block" key={key}>
                            <div className="sm-flex align-center">
                                <CaretRightOutlined rotate={includes(activeCategory, key) ? 90 : 0} />
                                <div className="margin-left-12 heading-3">{i18n._(definitionByCategory[key][0].i18nCategory || 'key-default_category-Custom')}</div>
                            </div>
                            <div className={`${includes(activeCategory, key) ? 'sm-grid grid-template-columns-for-material-settings grid-row-gap-16 grid-column-gap-32' : 'display-none'}`}>
                                {
                                    definitionByCategory[key].map(definition => {
                                        const selectedDefinitionId = activeNozzle === LEFT ? leftMaterialDefinitionId : rightMaterialDefinitionId;
                                        return (
                                            <Anchor
                                                className={classNames(`height-40 border-radius-100 padding-horizontal-16 sm-flex align-center border-default-grey-1 ${selectedDefinitionId === definition.definitionId ? 'border-blod-blue-2' : ''}`, styles['material-item'])}
                                                onClick={(e) => handleUpdateDefinition(e, definition.definitionId)}
                                                onDoubleClick={onShowPrintingManager}
                                            >
                                                <div className="sm-flex align-center">
                                                    <div className="width-16 height-16 border-default-grey-1 margin-right-8 " style={{ background: `${definition?.settings?.color?.default_value}` }} />
                                                    <span>{i18n._(definition.i18nName || definition.name)}</span>
                                                </div>
                                                <div className={classNames(styles['material-more-action'])}>
                                                    <Popover
                                                        content={() => renderMaterialMore(definition)}
                                                        placement="bottomRight"
                                                    >
                                                        <SvgIcon
                                                            name="More"
                                                            size={24}
                                                            type={['static']}
                                                        />
                                                    </Popover>
                                                </div>
                                            </Anchor>
                                        );
                                    })
                                }
                            </div>
                        </Anchor>
                    );
                })}
            </div>
            {showCreateMaterialModal && (
                <AddMaterialModel
                    setShowCreateMaterialModal={setShowCreateMaterialModal}
                    onSubmit={handleAddMaterial}
                />
            )}
            <PrintingManager />
        </div>
    );
};

MaterialSettings.propTypes = {
    toolHead: PropTypes.string
};

export default MaterialSettings;
