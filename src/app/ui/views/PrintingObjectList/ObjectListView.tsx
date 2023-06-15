import classNames from 'classnames';
import { find } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import sceneActions from '../../../flux/printing/actions-scene';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { machineStore } from '../../../store/local-storage';
import Dropdown from '../../components/Dropdown';
import ObjectListItem, { getColorsUsed, getExtrudersUsed, renderExtruderIcon, whiteHex } from './ObjectListItem';
import { getExtruderConfigOverlay, getSupportExtruderOverlay } from './model-extruder-overlay';
import styles from './styles.styl';


/**
 * Object list view for 3D scene.
 *
 * Including scene nodes and virtual nodes like prime tower, support, adhesion.
 *
 */
const ObjectListView: React.FC = () => {
    const dispatch = useDispatch();

    const selectedModelArray = useSelector((state: RootState) => state.printing?.modelGroup?.selectedModelArray);
    const models = useSelector((state: RootState) => state.printing.modelGroup.models);
    const inProgress = useSelector((state: RootState) => state.printing?.inProgress);
    const leftBarOverlayVisible = useSelector((state: RootState) => state.printing?.leftBarOverlayVisible);

    // const thisDisabled = leftBarOverlayVisible;
    const isDual = isDualExtruder(machineStore.get('machine.toolHead.printingToolhead'));
    const defaultMaterialId: string = useSelector((state: RootState) => state?.printing?.defaultMaterialId);
    const defaultMaterialIdRight: string = useSelector((state: RootState) => state?.printing?.defaultMaterialIdRight);

    const materialDefinitions = useSelector((state: RootState) => state?.printing?.materialDefinitions);
    const [leftMaterialColor, setLeftMaterialColor] = useState(whiteHex);
    const [rightMaterialColor, setRightMaterialColor] = useState(whiteHex);
    // const [showList, setShowList] = useState(true);

    const helpersExtruderConfig = useSelector((state: RootState) => state.printing.helpersExtruderConfig);
    const supportExtruderConfig = useSelector((state: RootState) => state.printing.supportExtruderConfig, shallowEqual);

    const actions = {
        onClickModelNameBox(targetModel, event = null) {
            if (leftBarOverlayVisible) {
                return;
            }
            dispatch(printingActions.selectTargetModel(targetModel, event?.shiftKey));
        },
        onClickModelHideBox(targetModel) {
            if (leftBarOverlayVisible) {
                return;
            }
            const visible = targetModel.visible;
            actions.onClickModelNameBox(targetModel, { shiftKey: false });
            if (visible === true) {
                dispatch(sceneActions.hideModels(targetModel));
            } else {
                dispatch(sceneActions.showModels(targetModel));
            }
        },

    };

    const updateMaterialColor = useCallback((definition, direction: string) => {
        const color = definition?.settings?.color?.default_value;
        switch (direction) {
            case LEFT_EXTRUDER:
                setLeftMaterialColor(color);
                break;
            case RIGHT_EXTRUDER:
                setRightMaterialColor(color);
                break;
            default:
                break;
        }
    }, []);

    const allModels = (models) && models.filter(model => !model.supportTag);
    // const prevProps = usePrevious({
    //     allModels
    // });
    useEffect(() => {
        const leftDefinition = find(materialDefinitions, { definitionId: defaultMaterialId });
        updateMaterialColor(leftDefinition, LEFT_EXTRUDER);
    }, [materialDefinitions, defaultMaterialId, updateMaterialColor]);

    useEffect(() => {
        const rightDefinition = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        updateMaterialColor(rightDefinition, RIGHT_EXTRUDER);
    }, [materialDefinitions, defaultMaterialIdRight, updateMaterialColor]);

    const onSetSelectedModelsColored = useCallback((isColored: boolean) => {
        const shouldApplyChanges = !!isColored;
        dispatch(sceneActions.endMeshColoringMode(shouldApplyChanges));
    }, [dispatch]);

    /**
     * Update selected models assigned extruder.
     */
    const onUpdateSelectedModelsExtruder = useCallback(({ key, direction }) => {
        if (key === 'combined') {
            dispatch(printingActions.updateSelectedModelsExtruder({
                shell: direction,
                infill: direction,
            }));
        } else if (key === 'shell') {
            dispatch(printingActions.updateSelectedModelsExtruder({
                shell: direction,
            }));
        } else if (key === 'infill') {
            dispatch(printingActions.updateSelectedModelsExtruder({
                infill: direction,
            }));
        }
    }, [dispatch]);

    /**
     * Update helper's assigned extruder.
     */
    const onUpdateHelpersExtruder = useCallback(({ key, direction }) => {
        log.info('onChangeExtruder', key, direction);
        switch (key) {
            case 'adhesion':
                dispatch(printingActions.updateHelpersExtruder({
                    adhesion: direction,
                }));
                break;
            case 'support':
                // change both support and interface
                dispatch(printingActions.updateSupportExtruderConfig({
                    support: direction,
                    interface: direction,
                }));
                break;
            case 'support.interface':
                dispatch(printingActions.updateSupportExtruderConfig({
                    interface: direction,
                }));
                break;
            default:
                break;
        }
    }, [dispatch]);

    /**
     * Generic extruder overlay menu.
     */
    const getExtruderOverlayMenu = (key: string, selectedExtruder: string) => {
        return getExtruderConfigOverlay({
            key,
            selectedExtruder,
            colorL: leftMaterialColor,
            colorR: rightMaterialColor,
            onChange: onUpdateHelpersExtruder,
        });
    };

    /**
     * Overlay menu for support.
     */
    const getSupportExtruderOverlayMenu = useCallback(() => {
        return getSupportExtruderOverlay({
            supportExtruder: supportExtruderConfig.support,
            supportInterfaceExtruder: supportExtruderConfig.interface,
            colorL: leftMaterialColor,
            colorR: rightMaterialColor,
            onChange: onUpdateHelpersExtruder,
        });
    }, [supportExtruderConfig, leftMaterialColor, rightMaterialColor, onUpdateHelpersExtruder]);

    /*
    const renderExtruderStatus = (status) => {
        if (!status && selectedModelArray.length === 0) {
            status = '0';
        }
        const color1 = status === '1' ? rightMaterialColor : leftMaterialColor;
        const color2 = status === '0' ? leftMaterialColor : rightMaterialColor;
        return renderExtruderIcon([status], [color1, color2]);
    };
    */

    /**
     * Extruder Icon.
     */
    const renderExtruerIconForExtruderList = useCallback((extruderList: string[]) => {
        const extrudersUsed = getExtrudersUsed(extruderList);
        const colorsUsed = getColorsUsed(extruderList, [leftMaterialColor, rightMaterialColor]);

        return renderExtruderIcon(extrudersUsed, colorsUsed);
    }, [leftMaterialColor, rightMaterialColor]);

    return (
        <div
            className={classNames(
                styles['object-list-view'],
                'width-264',
                'border-top-normal',
            )}
        >
            <div
                className={
                    classNames(
                        styles['object-tree'],
                        'padding-vertical-4',
                    )
                }
            >
                {
                    allModels && allModels.length > 0 && allModels.map((model) => {
                        return (
                            <ObjectListItem
                                model={model}
                                key={model.modelID}
                                isSelected={selectedModelArray && selectedModelArray.includes(model)}
                                onSelect={actions.onClickModelNameBox}
                                onToggleVisible={actions.onClickModelHideBox}
                                disabled={leftBarOverlayVisible || inProgress}
                                extruderCount={isDual ? 2 : 1}
                                leftMaterialColor={leftMaterialColor}
                                rightMaterialColor={rightMaterialColor}
                                updateSelectedModelsExtruder={onUpdateSelectedModelsExtruder}
                                setSelectedModelsColored={onSetSelectedModelsColored}
                            />
                        );
                    })
                }
                {
                    allModels && allModels.length === 0 && (
                        <div className="padding-vertical-4 padding-horizontal-8">
                            <div className="height-24">
                                <span>{i18n._('key-Printing/No model(s).')}</span>
                            </div>
                        </div>
                    )
                }
            </div>
            {
                isDual && (
                    <div className="border-top-normal margin-bottom-8">
                        <div className="padding-vertical-4 padding-horizontal-8">
                            <div className="height-24 font-size-base font-weight-500">
                                {i18n._('Helpers')}
                            </div>
                        </div>
                        <div>
                            <div className="sm-flex align-center margin-top-8 margin-horizontal-8">
                                <span className="display-block sm-flex-width text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Adhesion')}</span>
                                <Dropdown
                                    placement="topLeft"
                                    overlay={getExtruderOverlayMenu('adhesion', helpersExtruderConfig.adhesion)}
                                    trigger={['click']}
                                >
                                    {/* {renderExtruderStatus(helpersExtruderConfig.adhesion)} */}
                                    {renderExtruerIconForExtruderList([helpersExtruderConfig.adhesion])}
                                </Dropdown>
                            </div>
                            <div className="sm-flex align-center margin-top-8 margin-horizontal-8">
                                <span className="display-block sm-flex-width text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Support')}</span>
                                <Dropdown
                                    placement="topLeft"
                                    overlay={getSupportExtruderOverlayMenu()}
                                    trigger={['click']}
                                >
                                    {
                                        renderExtruerIconForExtruderList([
                                            supportExtruderConfig.support,
                                            supportExtruderConfig.interface,
                                        ])
                                    }
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default ObjectListView;
