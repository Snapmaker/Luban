import classNames from 'classnames';
import { includes, remove } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dropdown } from 'antd';
import { MenuProps } from 'antd/lib/menu';

import { HEAD_PRINTING, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { getMachineSeriesWithToolhead, isDualExtruder } from '../../../constants/machines';
import { PRESET_CATEGORY_DEFAULT } from '../../../constants/preset';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';

import { RootState } from '../../../flux/index.def';
import { actions as projectActions } from '../../../flux/project';
import { getPresetOptions } from '../../utils/profileManager';
import styles from './styles.styl';
import CreatePresetModal from './CreatePresetModal';
import DeletePresetModal from './DeletePresetModal';
import usePresetActions from './usePresetActions';


/**
 * Returns menu configuration for presetModel.
 *
 * @param presetModel
 * @param onCopyPreset
 * @param onExportPreset
 * @param onDeletePreset
 */
// MenuProps
// https://4x.ant.design/components/menu/#ItemType
const getPresetItemDropdownMenuProps = ({ presetModel, onCopyPreset, onExportPreset, onDeletePreset }): MenuProps => {
    const items = [];

    items.push({
        key: 'menu:copy',
        label: (<div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Copy')}</div>),
    });

    items.push({
        key: 'menu:export',
        label: (<div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Export')}</div>),
    });

    items.push({
        key: 'menu:delete',
        label: (
            <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Delete')}</div>),
        disabled: presetModel.isRecommended,
    });

    function onClick({ key }) {
        switch (key) {
            case 'menu:copy': {
                onCopyPreset();
                break;
            }
            case 'menu:export': {
                onExportPreset();
                break;
            }
            case 'menu:delete': {
                onDeletePreset();
                break;
            }
            default:
                break;
        }
    }

    return {
        items,
        onClick,
    };
};

const getAddPresetMenuProps = ({ onCreatePreset }): MenuProps => {
    const items = [];

    items.push({
        key: 'menu:create',
        label: (
            <div className="width-112 height-88 sm-flex sm-flex-direction-c align-center margin-right-8">
                <SvgIcon
                    name="PresetQuickCreate"
                    className="margin-bottom-8"
                    size={48}
                />
                <span className="width-percent-100 text-overflow-ellipsis align-c">{i18n._('key-Printing/ProfileManager-Quick Create')}</span>
            </div>
        ),
    });

    items.push({
        key: 'menu:create-import',
        label: (
            <div className="width-112 height-88 sm-flex sm-flex-direction-c align-center">
                <SvgIcon
                    name="PresetLocal"
                    className="margin-bottom-8"
                    size={48}
                />
                <span className="width-percent-100 text-overflow-ellipsis align-c">{i18n._('key-Printing/ProfileManager-Local Import')}</span>
            </div>
        ),
    });

    function onClick({ key }) {
        switch (key) {
            case 'menu:create':
                onCreatePreset();
                break;
            case 'menu:create-import':
                break;
            default:
                break;
        }
    }

    return {
        items,
        onClick,
    };
};

/**
 * Stack and preset selector.
 *
 * Select a stack, and then select a preset for it.
 *
 * Currently, we only support LEFT_EXTRUDER and RIGHT_EXTRUDER stack.
 */
declare type StackPresetSelectorProps = {
    selectedStackId: string;
    selectedPresetId: string;
    onSelectStack: (string) => void;
    onSelectPreset: (string) => void;
};
const StackPresetSelector: React.FC<StackPresetSelectorProps> = ({ selectedStackId, selectedPresetId, onSelectStack, onSelectPreset }) => {
    const dispatch = useDispatch();

    const { series, toolHead, toolHead: { printingToolhead } } = useSelector((state: RootState) => state.machine);
    const presetActions = usePresetActions();

    // quality
    const {
        qualityDefinitions,
        qualityDefinitionsRight,
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,
    } = useSelector((state: RootState) => state.printing);

    const [presetModel, setPresetModel] = useState(null);
    const [presetOptionsObj, setPresetOptionsObj] = useState(null);
    const [categories, setCategories] = useState([]);

    // expanded categories, only for displaying
    const [expandedPresetCategories, setExpandedPresetCategories] = useState([PRESET_CATEGORY_DEFAULT]);

    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;

        const materialPresetId = selectedStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;
        const materialPreset = materialDefinitions.find(p => p.definitionId === materialPresetId);

        const newPresetOptionsObj = getPresetOptions(presetModels, materialPreset);
        setPresetOptionsObj(newPresetOptionsObj);

        const newCategories = Object.keys(newPresetOptionsObj);
        setCategories(newCategories);

        // set all preset categories expanded
        setExpandedPresetCategories(Object.keys(newPresetOptionsObj));
    }, [selectedStackId, defaultMaterialId, defaultMaterialIdRight, qualityDefinitions, qualityDefinitionsRight]);

    // Get active preset model
    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const targetPresetModel = presetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(targetPresetModel);
    }, [selectedStackId, selectedPresetId]);

    // stackId: LEFT_EXTRUDER or RIGHT_EXTRUDER
    // Maybe support a global stack later
    function selectStack(stackId) {
        onSelectStack(stackId);
    }

    /**
     * Toggle expansion of a preset category.
     *
     * @param presetCategory
     */
    const togglePresetCategoryExpansion = (presetCategory) => {
        const newCategories = [...expandedPresetCategories];
        if (includes(expandedPresetCategories, presetCategory)) {
            remove(newCategories, (item) => {
                return item === presetCategory;
            });
        } else {
            newCategories.push(presetCategory);
        }
        setExpandedPresetCategories(newCategories);
    };

    /**
     * Select preset for selected stack.
     *
     * @param presetId
     */
    function selectPresetByPresetId(presetId) {
        onSelectPreset(presetId);
    }

    const [showCreatePresetModal, setShowCreatePresetModal] = useState(false);
    const [showCopyPresetModal, setShowCopyPresetModal] = useState(false);
    const [showDeletePresetModal, setShowDeletePresetModal] = useState(false);

    const actions = {
        // Export preset as file
        exportConfigFile: (presetId) => {
            if (!presetModel) {
                return;
            }

            const targetFile = `${presetId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(
                series,
                toolHead
            );

            dispatch(
                projectActions.exportConfigFile(
                    targetFile,
                    `${HEAD_PRINTING}/${currentMachine.configPathname[HEAD_PRINTING]}`,
                    `${presetModel.name}.def.json`
                )
            );
        }
    };

    return (
        <div
            className="width-264 min-width-264 background-color-white height-percent-100 sm-flex sm-flex-direction-c"
            style={{
                minWidth: '264px'
            }}
        >
            <div className="height-60 border-bottom-normal">
                <div className="sm-flex justify-space-between height-percent-100 unit-text padding-horizontal-16">
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === LEFT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(LEFT_EXTRUDER)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === LEFT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Left Extruder')}
                        </span>
                    </Anchor>
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === RIGHT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(RIGHT_EXTRUDER)}
                        disabled={!isDualExtruder(printingToolhead)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === RIGHT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Right Extruder')}
                        </span>
                    </Anchor>
                </div>
            </div>
            <div className="flex-grow-1">
                {
                    presetModel && presetOptionsObj && Object.keys(presetOptionsObj).map((presetCategory) => {
                        const expanded = includes(expandedPresetCategories, presetCategory);

                        const categoryInfo = presetOptionsObj[presetCategory];
                        const options = categoryInfo.options;

                        return (
                            <li key={presetCategory}>
                                <Anchor onClick={() => togglePresetCategoryExpansion(presetCategory)}>
                                    <div className={classNames('width-percent-100')}>
                                        <SvgIcon
                                            name="DropdownOpen"
                                            type={['static']}
                                            className={classNames({ 'rotate270': !expanded })}
                                        />
                                        <span>{categoryInfo.category}</span>
                                    </div>
                                </Anchor>
                                <ul style={{ listStyle: 'none', padding: '0' }}>
                                    {
                                        expanded && options.length > 0 && options.map(option => {
                                            const isSelectedPreset = selectedPresetId === option.definitionId;
                                            return (
                                                <li
                                                    key={option.definitionId}
                                                    className={classNames(
                                                        'display-block height-32',
                                                        styles['preset-item'],
                                                        {
                                                            [styles.selected]: isSelectedPreset,
                                                            'background-color-blue': isSelectedPreset,
                                                        },
                                                    )}
                                                >
                                                    <Anchor
                                                        className={classNames(
                                                            'width-percent-100',
                                                            'text-overflow-ellipsis',
                                                            'sm-flex',
                                                            'justify-flex-end',
                                                        )}
                                                        onClick={() => selectPresetByPresetId(option.definitionId)}
                                                    >
                                                        <span className="sm-flex-width border-radius-4 height-32 padding-horizontal-24 text-overflow-ellipsis" style={{ minWidth: 0 }}>
                                                            {option.label}
                                                        </span>
                                                        {
                                                            isSelectedPreset && (
                                                                <div className={classNames('width-32 height-32 margin-right-4', styles['preset-actions'])}>
                                                                    <Dropdown
                                                                        placement="bottomRight"
                                                                        overlayClassName={classNames('border-radius-8', 'border-default-black-5')}
                                                                        menu={getPresetItemDropdownMenuProps({
                                                                            presetModel,
                                                                            onCopyPreset: () => setShowCopyPresetModal(true),
                                                                            onExportPreset: () => actions.exportConfigFile(presetModel.definitionId),
                                                                            onDeletePreset: () => setShowDeletePresetModal(true),
                                                                        })}
                                                                    >
                                                                        <SvgIcon
                                                                            name="More"
                                                                            size={24}
                                                                            hoversize={24}
                                                                            type={['static']}
                                                                        />
                                                                    </Dropdown>
                                                                </div>
                                                            )
                                                        }
                                                    </Anchor>
                                                </li>
                                            );
                                        })
                                    }
                                </ul>
                            </li>
                        );
                    })
                }
            </div>
            <div className="margin-bottom-16">
                <Dropdown
                    placement="top"
                    overlayClassName={classNames('horizontal-menu')}
                    trigger={['click']}
                    menu={getAddPresetMenuProps({
                        onCreatePreset: () => setShowCreatePresetModal(true),
                    })}
                >
                    <Button
                        type="default"
                        priority="level-two"
                        className="padding-horizontal-16"
                    >
                        {i18n._('key-ProfileManager/Add Profile')}
                    </Button>
                </Dropdown>
            </div>
            <div className="margin-bottom-16" />
            {/* Create Preset Modal */}
            {
                showCreatePresetModal && (
                    <CreatePresetModal
                        createOrCopy="create"
                        presetModel={presetModel}
                        categories={categories}
                        presetActions={presetActions}
                        onClose={() => setShowCreatePresetModal(false)}
                    />
                )
            }
            {/* Copy Preset Modal */}
            {
                showCopyPresetModal && (
                    <CreatePresetModal
                        createOrCopy="copy"
                        presetModel={presetModel}
                        categories={categories}
                        presetActions={presetActions}
                        onClose={() => setShowCopyPresetModal(false)}
                    />
                )
            }
            {/* Delete Preset Modal */}
            {
                showDeletePresetModal && (
                    <DeletePresetModal
                        presetModel={presetModel}
                        presetActions={presetActions}
                        onClose={() => setShowDeletePresetModal(false)}
                    />
                )
            }
        </div>
    );
};

export default StackPresetSelector;
