import { Dropdown } from 'antd';
import { MenuProps } from 'antd/lib/menu';
import classNames from 'classnames';
import { includes, remove } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { HEAD_PRINTING, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { getMachineSeriesWithToolhead, isDualExtruder } from '../../../constants/machines';
import { PRESET_CATEGORY_DEFAULT } from '../../../constants/preset';
import log from '../../../lib/log';

import { RootState } from '../../../flux/index.def';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import { getPresetOptions } from '../../utils/profileManager';
import CreatePresetModal from './modals/CreatePresetModal';
import DeletePresetModal from './DeletePresetModal';
import ResetPresetModal from './ResetPresetModal';
import styles from './styles.styl';
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
const getPresetItemDropdownMenuProps = ({ presetModel, onCopyPreset, onResetPreset, onExportPreset, onDeletePreset, options }): MenuProps => {
    const items = [];

    items.push({
        key: 'menu:copy',
        label: (<div className="width-120 text-overflow-ellipsis">{i18n._('key-App/Menu-Copy')}</div>),
    });

    if (presetModel.isRecommended) {
        items.push({
            key: 'menu:reset',
            label: (<div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Reset')}</div>),
            disabled: !options.canReset,
        });
    }

    items.push({
        key: 'menu:delete',
        label: (
            <div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Delete')}</div>),
        disabled: presetModel.isRecommended,
    });

    items.push({
        key: 'menu:export',
        label: (<div className="width-120 text-overflow-ellipsis">{i18n._('key-Printing/ProfileManager-Export')}</div>),
    });


    function onClick({ key }) {
        switch (key) {
            case 'menu:copy': {
                onCopyPreset();
                break;
            }
            case 'menu:reset': {
                onResetPreset();
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

const getAddPresetMenuProps = ({ onCreatePreset, onImportPreset }): MenuProps => {
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
                onImportPreset();
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
interface StackPresetSelectorProps {
    selectedStackId: string;
    selectedPresetId: string;
    isValuesAllDefaultValues: boolean;
    onSelectStack: (stackId: string) => void;
    onSelectPreset: (presetId: string) => void;
}

const StackPresetSelector: React.FC<StackPresetSelectorProps> = (props) => {
    const { selectedStackId, selectedPresetId, isValuesAllDefaultValues, onSelectStack, onSelectPreset } = props;

    const dispatch = useDispatch();

    const { series, toolHead, toolHead: { printingToolhead } } = useSelector((state: RootState) => state.machine);
    const presetActions = usePresetActions();

    const isDual = isDualExtruder(printingToolhead);

    // quality
    const {
        extruderLDefinition,
        extruderRDefinition,

        qualityDefinitions: qualityPresetModels,
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
        const materialPresetId = selectedStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;
        const materialPreset = materialDefinitions.find(p => p.definitionId === materialPresetId);

        const nozzleSize = selectedStackId === LEFT_EXTRUDER
            ? extruderLDefinition?.settings.machine_nozzle_size.default_value
            : extruderRDefinition?.settings.machine_nozzle_size.default_value;

        const presetFilters = {
            materialType: materialPreset?.materialType,
            nozzleSize,
        };

        const newPresetOptionsObj = getPresetOptions(qualityPresetModels, presetFilters);
        setPresetOptionsObj(newPresetOptionsObj);

        const newCategories = Object.keys(newPresetOptionsObj);
        setCategories(newCategories);

        // set all preset categories expanded
        setExpandedPresetCategories(Object.keys(newPresetOptionsObj));
    }, [
        selectedStackId, defaultMaterialId, defaultMaterialIdRight, materialDefinitions, qualityPresetModels,
        extruderLDefinition?.settings.machine_nozzle_size.default_value,
        extruderRDefinition?.settings.machine_nozzle_size.default_value,
    ]);

    // Get active preset model
    useEffect(() => {
        const targetPresetModel = qualityPresetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(targetPresetModel);
    }, [selectedStackId, selectedPresetId, qualityPresetModels]);

    // stackId: LEFT_EXTRUDER or RIGHT_EXTRUDER
    // Maybe support a global stack later
    const selectStack = useCallback((stackId: string) => {
        onSelectStack(stackId);
    }, [onSelectStack]);

    /**
     * Toggle expansion of a preset category.
     *
     * @param presetCategory
     */
    const togglePresetCategoryExpansion = useCallback((presetCategory: string) => {
        const newCategories = [...expandedPresetCategories];
        if (includes(expandedPresetCategories, presetCategory)) {
            remove(newCategories, (item) => {
                return item === presetCategory;
            });
        } else {
            newCategories.push(presetCategory);
        }
        setExpandedPresetCategories(newCategories);
    }, [expandedPresetCategories]);

    /**
     * Select preset for selected stack.
     *
     * @param presetId
     */
    const selectPresetByPresetId = useCallback((presetId: string) => {
        onSelectPreset(presetId);
    }, [onSelectPreset]);

    const [showCreatePresetModal, setShowCreatePresetModal] = useState(false);
    const [showCopyPresetModal, setShowCopyPresetModal] = useState(false);
    const [showResetPresetModal, setShowResetPresetModal] = useState(false);
    const [showDeletePresetModal, setShowDeletePresetModal] = useState(false);
    const importPresetFileInput = useRef(null);

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
                    currentMachine.configPathname[HEAD_PRINTING],
                    `${presetModel.name}.def.json`
                )
            );
        },
        importPresetStep1: () => {
            importPresetFileInput.current.value = null;
            importPresetFileInput.current.click();
        },
        importPresetStep2: async (event) => {
            // const definition = await outsideActions.onChangeFileForManager(e);
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const definition = await presetActions.createPreset(file);
            log.info(`Created preset ${definition.definitionId} from file "${file.name}".`);

            // select the new preset after definitions refreshed
            selectPresetByPresetId(definition.definitionId);
        },
    };

    return (
        <div
            className="width-264 min-width-264 background-color-white height-percent-100 sm-flex sm-flex-direction-c"
            style={{
                minWidth: '264px'
            }}
        >
            {
                isDual && (
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
                                disabled={!isDual}
                            >
                                <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === RIGHT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                                    {i18n._('Right Extruder')}
                                </span>
                            </Anchor>
                        </div>
                    </div>
                )
            }
            <div className="flex-grow-1">
                {
                    presetModel && presetOptionsObj && Object.keys(presetOptionsObj).map((presetCategory) => {
                        const expanded = includes(expandedPresetCategories, presetCategory);

                        const categoryInfo = presetOptionsObj[presetCategory];
                        const options = categoryInfo.options;

                        if (options.length === 0) {
                            return null;
                        }

                        return (
                            <li key={presetCategory}>
                                <Anchor onClick={() => togglePresetCategoryExpansion(presetCategory)}>
                                    <div className={classNames('width-percent-100', 'height-32')}>
                                        <SvgIcon
                                            name="DropdownOpen"
                                            type={['static']}
                                            className={classNames({ 'rotate270': !expanded })}
                                        />
                                        <span>{categoryInfo.category}</span>
                                    </div>
                                </Anchor>
                                {
                                    expanded && (
                                        <ul style={{ listStyle: 'none', padding: '0' }}>
                                            {
                                                expanded && options.length > 0 && options.map(option => {
                                                    const isPresetSelected = selectedPresetId === option.definitionId;
                                                    return (
                                                        <li
                                                            key={option.definitionId}
                                                            className={classNames(
                                                                'display-block height-32',
                                                                styles['preset-item'],
                                                                {
                                                                    [styles.selected]: isPresetSelected,
                                                                    'background-color-blue-4': isPresetSelected,
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
                                                                    isPresetSelected && (
                                                                        <div className={classNames('width-32 height-32 margin-right-4', styles['preset-actions'])}>
                                                                            <Dropdown
                                                                                placement="bottomRight"
                                                                                overlayClassName={classNames('border-radius-8', 'border-default-black-5')}
                                                                                menu={getPresetItemDropdownMenuProps({
                                                                                    presetModel,
                                                                                    onCopyPreset: () => setShowCopyPresetModal(true),
                                                                                    onResetPreset: () => setShowResetPresetModal(true),
                                                                                    onExportPreset: () => actions.exportConfigFile(presetModel.definitionId),
                                                                                    onDeletePreset: () => setShowDeletePresetModal(true),
                                                                                    options: {
                                                                                        canReset: !isValuesAllDefaultValues,
                                                                                    }
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
                                    )
                                }
                            </li>
                        );
                    })
                }
            </div>
            <div className="margin-bottom-16">
                <input
                    ref={importPresetFileInput}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.importPresetStep2}
                />
                <Dropdown
                    placement="top"
                    overlayClassName={classNames('horizontal-menu')}
                    trigger={['click']}
                    menu={getAddPresetMenuProps({
                        onCreatePreset: () => setShowCreatePresetModal(true),
                        onImportPreset: () => actions.importPresetStep1(),
                    })}
                >
                    {/* @ts-ignore */}
                    <Button
                        type="default"
                        priority="level-two"
                        className="padding-horizontal-16"
                    >
                        {i18n._('key-ProfileManager/Add Profile')}
                    </Button>
                </Dropdown>
            </div>
            {/* Create Preset Modal */}
            {
                showCreatePresetModal && presetModel && (
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
                showCopyPresetModal && presetModel && (
                    <CreatePresetModal
                        createOrCopy="copy"
                        presetModel={presetModel}
                        categories={categories}
                        presetActions={presetActions}
                        onClose={() => setShowCopyPresetModal(false)}
                    />
                )
            }
            {/* Reset Preset Modal */}
            {
                showResetPresetModal && presetModel && (
                    <ResetPresetModal
                        presetModel={presetModel}
                        presetActions={presetActions}
                        onClose={() => setShowResetPresetModal(false)}
                    />
                )
            }
            {/* Delete Preset Modal */}
            {
                showDeletePresetModal && presetModel && (
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
