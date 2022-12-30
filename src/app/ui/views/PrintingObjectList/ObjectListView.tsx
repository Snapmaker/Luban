import classNames from 'classnames';
import { find } from 'lodash';
import React, { useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import i18n from '../../../lib/i18n';
import Menu from '../../components/Menu';
import Dropdown from '../../components/Dropdown';
import SvgIcon from '../../components/SvgIcon';
import { actions as printingActions } from '../../../flux/printing';
import { machineStore } from '../../../store/local-storage';
import ObjectListItem, { renderExtruderIcon, whiteHex } from './ObjectListItem';
import styles from './styles.styl';
import { RootState } from '../../../flux/index.def';

export const extruderOverlayMenu = ({ type, colorL, colorR, onChange, selectExtruder = null }) => {
    return (
        <Menu
            selectedKeys={selectExtruder ? [selectExtruder] : []}
        >
            <Menu.Item
                onClick={() => onChange({ type, direction: '0' })}
                key="L"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder L')}</span>
                    {colorL !== whiteHex ? (
                        <SvgIcon
                            name="Extruder"
                            size={24}
                            color={colorL}
                            type={['static']}
                        />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
            <Menu.Item
                onClick={() => onChange({ type, direction: '1' })}
                key="R"
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder R')}</span>
                    {colorR !== whiteHex ? (
                        <SvgIcon
                            name="Extruder"
                            size={24}
                            color={colorR}
                            type={['static']}
                        />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
        </Menu>
    );
};

/**
 * Object list view for 3D scene.
 *
 * Including scene nodes and virtual nodes like prime tower, support, adhesion.
 *
 */
const ObjectListView: React.FC = () => {
    const selectedModelArray = useSelector((state: RootState) => state.printing?.modelGroup?.selectedModelArray);
    const models = useSelector((state: RootState) => state.printing.modelGroup.models);
    const inProgress = useSelector((state: RootState) => state?.printing?.inProgress);
    const leftBarOverlayVisible = useSelector((state: RootState) => state?.printing?.leftBarOverlayVisible);
    // const thisDisabled = leftBarOverlayVisible;
    const isDual = isDualExtruder(machineStore.get('machine.toolHead.printingToolhead'));
    const defaultMaterialId = useSelector((state: RootState) => state?.printing?.defaultMaterialId);
    const defaultMaterialIdRight = useSelector((state: RootState) => state?.printing?.defaultMaterialIdRight);
    const materialDefinitions = useSelector((state: RootState) => state?.printing?.materialDefinitions);
    const [leftMaterialColor, setLeftMaterialColor] = useState(whiteHex);
    const [rightMaterialColor, setRightMaterialColor] = useState(whiteHex);
    // const [showList, setShowList] = useState(true);
    const dispatch = useDispatch();


    const helpersExtruderConfig = useSelector((state: RootState) => state.printing.helpersExtruderConfig);

    const [helpersExtruder, setHelpersExtruder] = useState(helpersExtruderConfig);

    const actions = {
        onClickModelNameBox(targetModel, event) {
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
                dispatch(printingActions.hideSelectedModel(targetModel));
            } else {
                dispatch(printingActions.showSelectedModel(targetModel));
            }
        },
        updateMaterialColor(definition, direction) {
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
        },
        updateSelectedModelsExtruder(direction) {
            window.dispatchEvent(
                new CustomEvent('change-extruder', {
                    detail: { type: 'models.multiple', direction }
                })
            );
            dispatch(printingActions.updateSelectedModelsExtruder({ infill: direction, shell: direction }));
        }
    };

    const allModels = (models) && models.filter(model => !model.supportTag);
    // const prevProps = usePrevious({
    //     allModels
    // });
    useEffect(() => {
        const leftDefinition = find(materialDefinitions, { definitionId: defaultMaterialId });
        const rightDefinition = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        actions.updateMaterialColor(leftDefinition, LEFT_EXTRUDER);
        actions.updateMaterialColor(rightDefinition, RIGHT_EXTRUDER);
    }, [materialDefinitions]);

    useEffect(() => {
        const leftDefinition = find(materialDefinitions, { definitionId: defaultMaterialId });
        actions.updateMaterialColor(leftDefinition, LEFT_EXTRUDER);
    }, [defaultMaterialId]);

    useEffect(() => {
        const rightDefinition = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        actions.updateMaterialColor(rightDefinition, RIGHT_EXTRUDER);
    }, [defaultMaterialIdRight]);


    const onChangeExtruder = ({ type, direction }) => {
        console.log('onChangeExtruder', type, direction);
        const typeArr = type.split('.');
        switch (typeArr[1]) {
            case 'adhesion':
                setHelpersExtruder({
                    ...helpersExtruder,
                    adhesion: direction,
                });
                dispatch(printingActions.updateHelpersExtruder({
                    support: helpersExtruder.support,
                    adhesion: direction,
                }));
                break;
            case 'support':
                setHelpersExtruder({
                    ...helpersExtruder,
                    support: direction,
                });
                dispatch(printingActions.updateHelpersExtruder({
                    adhesion: helpersExtruder.adhesion,
                    support: direction,
                }));
                break;

            default:
                break;
        }
    };

    const extruderOverlay = (type, _selectExtruder = '') => {
        const selectExtruder = (() => {
            switch (_selectExtruder.toString()) {
                case '0':
                    return 'L';
                case '1':
                    return 'R';
                default:
                    return null;
            }
        })();

        return extruderOverlayMenu({
            type,
            colorL: leftMaterialColor,
            colorR: rightMaterialColor,
            onChange: onChangeExtruder,
            selectExtruder
        });
    };

    const renderExtruderStatus = (status) => {
        if (!status && selectedModelArray.length === 0) {
            status = '0';
        }
        const color1 = status === '1' ? rightMaterialColor : leftMaterialColor;
        const color2 = status === '0' ? leftMaterialColor : rightMaterialColor;
        return renderExtruderIcon([status], [color1, color2]);
    };

    return (
        <div
            className={classNames(
                styles['object-list-view'],
                'width-264',
                'background-color-white',
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
                                updateSelectedModelsExtruder={actions.updateSelectedModelsExtruder}
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
                                    placement="topRight"
                                    overlay={extruderOverlay('helpers.adhesion', helpersExtruder.adhesion)}
                                    trigger={['click']}
                                >
                                    {renderExtruderStatus(helpersExtruder.adhesion)}
                                </Dropdown>
                            </div>
                            <div className="sm-flex align-center margin-top-8 margin-horizontal-8">
                                <span className="display-block sm-flex-width text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Support')}</span>
                                <Dropdown
                                    placement="bottomRight"
                                    overlay={extruderOverlay('helpers.support', helpersExtruder.support)}
                                    trigger={['click']}
                                >
                                    {renderExtruderStatus(helpersExtruder.support)}
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
