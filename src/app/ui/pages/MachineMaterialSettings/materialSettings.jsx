import { CaretRightOutlined } from '@ant-design/icons';
import { Menu, message, Spin, Tooltip } from 'antd';
import classNames from 'classnames';
import { cloneDeep, filter, find, findIndex, includes, orderBy } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { LEFT, RIGHT } from '../../../../server/constants';
import {
    HEAD_PRINTING,
    LEFT_EXTRUDER,
    MATERIAL_TYPE_OPTIONS,
    PRINTING_MANAGER_TYPE_MATERIAL,
    RIGHT_EXTRUDER
} from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { machineStore } from '../../../store/local-storage';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Dropdown from '../../components/Dropdown';
import SvgIcon from '../../components/SvgIcon';
import PrintingManager from '../../views/PrintingManager';
import { materialCategoryRank, useGetDefinitions } from '../../views/ProfileManager';
import AddMaterialModel from './addMaterialModel';
import styles from './styles.styl';

const MATERIAL_TYPE_ARRAY = MATERIAL_TYPE_OPTIONS.map(d => d.category);

const MaterialSettings = ({ toolMap, loading }) => {
    const materialActiveCategory = machineStore.get('settings.materialActiveCategory');
    const {
        defaultMaterialId,
        defaultMaterialIdRight,
        materialDefinitions,
        materialManagerDirection,
    } = useSelector(state => state.printing);

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
        if (definition) {
            dispatch(
                printingActions.updateDefaultMaterialId(
                    definition.definitionId,
                    LEFT_EXTRUDER
                )
            );
        }
    }, [materialDefinitions, leftMaterialDefinitionId]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === rightMaterialDefinitionId
        );
        if (definition) {
            dispatch(
                printingActions.updateDefaultMaterialId(
                    definition.definitionId,
                    RIGHT_EXTRUDER
                )
            );
        }
    }, [materialDefinitions, rightMaterialDefinitionId]);
    useEffect(() => {
        let definitionByCategoryTemp = {};
        materialDefinitions.forEach((definition) => {
            if (!(MATERIAL_TYPE_ARRAY.includes(definition.category))) {
                definition.category = 'Other';
                definition.i18nCategory = 'Other';
            }
            if (definitionByCategoryTemp[definition.category]) {
                definitionByCategoryTemp[definition.category].push(definition);
            } else {
                definitionByCategoryTemp[definition.category] = [definition];
                const rank = findIndex(materialCategoryRank, arr => {
                    return arr === definition.category;
                });
                definitionByCategoryTemp[definition.category].rank = rank;
            }
        });
        definitionByCategoryTemp = orderBy(definitionByCategoryTemp, ['rank'], ['asc']);
        setDefinitionByCategory(definitionByCategoryTemp);
    }, [materialDefinitions]);

    const handleUpdateDefinition = (e, id) => {
        e.stopPropagation();
        if (activeNozzle === LEFT) {
            setLeftMaterialDefinitionId(id);
        } else {
            setRightMaterialDefinitionId(id);
        }
        dispatch(printingActions.updateDefaultIdByType(PRINTING_MANAGER_TYPE_MATERIAL, id, activeNozzle));
        dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
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
            <Menu>
                <Menu.Item>
                    <Anchor className="display-block" onClick={onShowPrintingManager}>{i18n._('key-machineMaterialSettings/Profile-update')}</Anchor>
                </Menu.Item>
                {
                    !definition?.isDefault && (
                        <Menu.Item>
                            <Anchor className="display-block" onClick={e => handleDeleteMaterial(e, definition)}>{i18n._('key-App/Menu-Delete')}</Anchor>
                        </Menu.Item>
                    )
                }
            </Menu>
        );
    };
    const importFile = (ref) => {
        ref.current.value = null;
        ref.current.click();
    };

    const handleAddMaterial = async (data) => {
        const newDefinitionForManager = cloneDeep(definitionState.definitionForManager);
        newDefinitionForManager.category = data.type;
        newDefinitionForManager.name = data.name;
        newDefinitionForManager.i18nCategory = data.type;
        if (Object.keys(newDefinitionForManager.settings).length === 0) {
            newDefinitionForManager.settings = cloneDeep(materialDefinitions[0].settings);
        }
        newDefinitionForManager.settings = {
            ...newDefinitionForManager.settings,
            material_type: {
                default_value: (data.type).toLowerCase()
            },
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

            dispatch(printingActions.updateCurrentDefinition({
                PRINTING_MANAGER_TYPE_MATERIAL,
                definitionModel: selected,
                changedSettingArray: [
                    ['color', data.color],
                    ['material_print_temperature', data.printingTemperature],
                    ['material_bed_temperature', data.buildPlateTemperature],
                    ['cool_fan_speed', data.openFan ? 100 : 0],
                ],
            }));
        }


        message.info({
            content: (
                <span className="height-30">
                    {i18n._('key-profileManager/Create Success')}
                    <Anchor
                        onClick={() => {
                            onShowPrintingManager();
                            message.destroy();
                        }}
                        style={{ color: '#1890FF', marginLeft: '32px' }}
                    >
                        {i18n._('key-profileManager/Open material profile')}
                    </Anchor>
                    <SvgIcon
                        name="Cancel"
                        type={['hoverNormal', 'pressNormal']}
                        onClick={() => {
                            message.destroy();
                        }}
                    />
                </span>
            ),
            className: classNames(styles['custom-message']),
            duration: 15
        });
    };
    const onChangeFileForManager = (event) => {
        const file = event.target.files[0];
        return dispatch(
            printingActions.onUploadManagerDefinition(
                file,
                PRINTING_MANAGER_TYPE_MATERIAL
            )
        );
    };
    useEffect(() => {
        if (defaultMaterialId !== leftMaterialDefinitionId) {
            setLeftMaterialDefinitionId(defaultMaterialId);
        }
        if (defaultMaterialId !== rightMaterialDefinitionId) {
            setRightMaterialDefinitionId(defaultMaterialIdRight);
        }
    }, [defaultMaterialId, defaultMaterialIdRight]);

    const renderAddMaterial = () => {
        return (
            <Menu>
                <Menu.Item key="quickCreate">
                    <Tooltip title={i18n._('key-Settings/Create Material Tips')}>
                        <Anchor className="sm-flex sm-flex-direction-c align-center width-112 height-88 border-radius-12" onClick={() => setShowCreateMaterialModal(true)}>
                            <SvgIcon
                                name="PresetQuickCreate"
                                size={48}
                                type={['hoverNormal', 'pressNormal']}
                            />
                            <span className="width-percent-100 height-16 text-overflow-ellipsis margin-top-16 align-c">{i18n._('key-Printing/ProfileManager-Quick Create')}</span>
                        </Anchor>
                    </Tooltip>
                </Menu.Item>
                <Menu.Item>
                    <Anchor className="sm-flex sm-flex-direction-c width-112 height-88 align-center border-radius-12" onClick={() => importFile(fileInput)}>
                        <SvgIcon
                            name="PresetLocal"
                            size={48}
                            type={['hoverNormal', 'pressNormal']}
                        />
                        <span className="width-percent-100 height-16 text-overflow-ellipsis margin-top-16 align-c">{i18n._('key-Printing/ProfileManager-Local Import')}</span>
                    </Anchor>
                </Menu.Item>
            </Menu>
        );
    };
    if (loading) {
        return (
            <div className="position-absolute position-absolute-center">
                <Spin />
            </div>
        );
    }
    return (
        <div className="padding-vertical-40 padding-horizontal-40 height-all-minus-60 overflow-y-auto">
            <div className="sm-flex justify-space-between">
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={async (e) => {
                        await onChangeFileForManager(e);
                    }}
                />
                <div className={`padding-horizontal-4 padding-vertical-4 border-radius-16 sm-flex background-grey-2 ${isDualExtruder(toolMap.printingToolhead) ? 'width-532' : 'width-272'}`}>
                    <Anchor onClick={() => setActiveNozzle(LEFT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-12 width-264 height-68 ${activeNozzle === LEFT ? 'background-color-white' : ''}`}>
                        {
                            isDualExtruder(toolMap.printingToolhead) && (
                                <div className="heading-3">
                                    {i18n._('key-setting/Left-Nozzle')}
                                </div>
                            )
                        }
                        {
                            !isDualExtruder(toolMap.printingToolhead) && (
                                <div className="heading-3">
                                    {i18n._('key-Laser/ToolpathParameters-Material')}
                                </div>
                            )
                        }
                        <div className="sm-flex align-center margin-top-8">
                            <div className="height-16 width-16 border-default-grey-1 " style={{ background: `${leftMaterialDefinition?.settings?.color?.default_value}` }} />
                            <span className="margin-left-8">{i18n._(leftMaterialDefinition?.i18nName || leftMaterialDefinition?.name)}</span>
                        </div>
                    </Anchor>
                    {
                        isDualExtruder(toolMap.printingToolhead) && (
                            <Anchor onClick={() => setActiveNozzle(RIGHT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-12 width-264 height-68 ${activeNozzle === RIGHT ? 'background-color-white' : ''}`}>
                                <div className="heading-3">{i18n._('key-setting/Right-Nozzle')}</div>
                                <div className="sm-flex align-center margin-top-8">
                                    <div className="height-16 width-16 border-default-grey-1" style={{ background: `${rightMaterialDefinition?.settings?.color?.default_value}` }} />
                                    <span className="margin-left-8">{i18n._(rightMaterialDefinition?.i18nName || rightMaterialDefinition?.name)}</span>
                                </div>
                            </Anchor>
                        )
                    }
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
                    <Dropdown
                        overlay={renderAddMaterial()}
                        placement="top"
                        trigger={['click']}
                        overlayClassName="horizontal-menu"
                    >
                        <Button
                            priority="level-two"
                            width="160px"
                            className="margin-left-16"
                        >
                            <span className="display-inline width-142 text-overflow-ellipsis">{i18n._('key-settings/Add Material')}</span>
                        </Button>
                    </Dropdown>
                </div>
            </div>
            <div>
                {Object.keys(definitionByCategory).map(key => {
                    return (
                        <div className="margin-top-36 display-block" key={key}>
                            <Anchor className="display-inline" onClick={() => onUpdateCategory(key)}>
                                <div className="sm-flex align-center">
                                    <CaretRightOutlined rotate={includes(activeCategory, key) ? 90 : 0} />
                                    <span className="margin-left-12 heading-3">{i18n._(definitionByCategory[key][0].i18nCategory || 'key-default_category-Custom')}</span>
                                </div>
                            </Anchor>
                            <div className={`${includes(activeCategory, key) ? 'sm-grid grid-template-columns-for-material-settings grid-row-gap-16 grid-column-gap-32' : 'display-none'}`}>
                                {
                                    definitionByCategory[key].map(definition => {
                                        const selectedDefinitionId = activeNozzle === LEFT ? leftMaterialDefinitionId : rightMaterialDefinitionId;
                                        return (
                                            <Anchor
                                                key={definition.definitionId}
                                                className={classNames(`height-40 padding-horizontal-16 sm-flex align-center border-default-grey-1 ${selectedDefinitionId === definition.definitionId ? 'border-blod-blue-2' : ''}`, styles['material-item'])}
                                                style={{ borderRadius: '100px' }}
                                                onClick={(e) => handleUpdateDefinition(e, definition.definitionId)}
                                                onDoubleClick={onShowPrintingManager}
                                            >
                                                <div className="sm-flex align-center width-percent-100">
                                                    <div className="width-16 height-16 border-default-grey-1 margin-right-8 border-radius-4" style={{ background: `${definition?.settings?.color?.default_value}` }} />
                                                    <span className="display-inline width-all-minus-45 text-overflow-ellipsis">{i18n._(definition.i18nName || definition.name)}</span>
                                                </div>
                                                <div className={classNames(styles['material-more-action'])}>
                                                    <Dropdown
                                                        overlay={renderMaterialMore(definition)}
                                                        placement="bottomRight"
                                                    >
                                                        <SvgIcon
                                                            name="More"
                                                            size={24}
                                                            type={['static']}
                                                        />
                                                    </Dropdown>
                                                </div>
                                            </Anchor>
                                        );
                                    })
                                }
                            </div>
                        </div>
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
    toolMap: PropTypes.object,
    loading: PropTypes.bool
};

export default MaterialSettings;
