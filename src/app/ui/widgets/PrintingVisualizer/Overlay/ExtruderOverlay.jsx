import classNames from 'classnames';
import { cloneDeep, find } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { BOTH_EXTRUDER_MAP_NUMBER, HEAD_PRINTING, LEFT_EXTRUDER_MAP_NUMBER } from '../../../../constants';
import { actions as printingActions } from '../../../../flux/printing';
import { actions as projectActions } from '../../../../flux/project';
import i18n from '../../../../lib/i18n';
import Dropdown from '../../../components/Dropdown';
import Menu from '../../../components/Menu';
import SvgIcon from '../../../components/SvgIcon';

/* eslint-disable-next-line import/no-cycle */
import { CancelButton, renderExtruderIcon, whiteHex } from '../VisualizerLeftBar';
import styles from './styles.styl';

const extruderLabelMap = {
    '0': 'Extruder L',
    '1': 'Extruder R',
    '2': 'Extruder Both'
};

const originalModelsExtruder = {
    multiple: LEFT_EXTRUDER_MAP_NUMBER,
    infill: LEFT_EXTRUDER_MAP_NUMBER,
    shell: LEFT_EXTRUDER_MAP_NUMBER
};

const originalHelpersExtruder = {
    multiple: LEFT_EXTRUDER_MAP_NUMBER,
    support: LEFT_EXTRUDER_MAP_NUMBER,
    adhesion: LEFT_EXTRUDER_MAP_NUMBER,
    onlySupportInterface: false
};

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

const ExtruderOverlay = React.memo((
    {
        setTransformMode
    }
) => {
    const dispatch = useDispatch();

    const {
        isOpenSelectModals, isOpenHelpers: _isOpenHelpers, modelExtruderInfoShow, helpersExtruderConfig
    } = useSelector(state => state?.printing);

    const [modelsExtruder, setModelsExtruder] = useState(originalModelsExtruder);
    const [helpersExtruder, setHelpersExtruder] = useState(helpersExtruderConfig || originalHelpersExtruder);
    const [isOpenModels, setIsOpenModels] = useState(isOpenSelectModals);
    const [isOpenHelpers, setIsOpenHelpers] = useState(_isOpenHelpers);
    const [colorL, setColorL] = useState(whiteHex);
    const [colorR, setColorR] = useState(whiteHex);

    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const isSelectedModelAllVisible = useSelector(state => state?.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);

    const handleOpen = (type) => {
        let temp = null;
        switch (type) {
            case 'models':
                temp = !isOpenModels;
                setIsOpenModels(temp);
                dispatch(printingActions.updateState({ isOpenSelectModals: temp }));
                break;
            case 'helpers':
                temp = !isOpenHelpers;
                setIsOpenHelpers(temp);
                dispatch(printingActions.updateState({ isOpenHelpers: temp }));
                break;
            default:
                break;
        }
    };
    const onChangeExtruder = (event) => {
        const { type, direction } = event.detail || event;
        const typeArr = type.split('.');
        switch (typeArr[1]) {
            case 'multiple':
                if (typeArr[0] === 'models') {
                    const newModelsExtruder = cloneDeep(modelsExtruder);
                    Object.keys(newModelsExtruder).forEach(key => {
                        newModelsExtruder[key] = direction;
                    });
                    setModelsExtruder(newModelsExtruder);
                    dispatch(printingActions.updateSelectedModelsExtruder({
                        infill: direction,
                        shell: direction,
                    }));
                } else {
                    const newHelpersExtruder = cloneDeep(helpersExtruder);
                    Object.keys(newHelpersExtruder).forEach(key => {
                        newHelpersExtruder[key] = direction;
                    });
                    setHelpersExtruder(newHelpersExtruder);
                    dispatch(printingActions.updateHelpersExtruder({
                        support: direction,
                        adhesion: direction,
                    }));
                }
                break;
            case 'infill':
                setModelsExtruder({
                    ...modelsExtruder,
                    infill: direction,
                    multiple: modelsExtruder.shell === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                });
                dispatch(printingActions.updateSelectedModelsExtruder({
                    infill: direction,
                    shell: modelsExtruder.shell
                }));
                break;
            case 'shell':
                setModelsExtruder({
                    ...modelsExtruder,
                    shell: direction,
                    multiple: modelsExtruder.infill === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                });
                dispatch(printingActions.updateSelectedModelsExtruder({
                    shell: direction,
                    infill: modelsExtruder.infill
                }));
                break;
            case 'adhesion':
                setHelpersExtruder({
                    ...helpersExtruder,
                    adhesion: direction,
                    multiple: helpersExtruder.support === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                });
                dispatch(printingActions.updateHelpersExtruder({
                    support: helpersExtruder.support,
                    adhesion: direction
                }));
                break;
            case 'support':
                setHelpersExtruder({
                    ...helpersExtruder,
                    support: direction,
                    multiple: helpersExtruder.adhesion === direction ? direction : BOTH_EXTRUDER_MAP_NUMBER
                });
                dispatch(printingActions.updateHelpersExtruder({
                    adhesion: helpersExtruder.adhesion,
                    support: direction
                }));
                break;
            default:
                break;
        }
        dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
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
            colorL,
            colorR,
            onChange: onChangeExtruder,
            selectExtruder
        });
    };
    const renderExtruderStatus = (status, disabled) => {
        if (!status && selectedModelArray.length === 0) {
            status = '0';
        }
        const leftExtruderColor = status === '1' ? colorR : colorL;
        const rightExtruderColor = status === '0' ? colorL : colorR;
        return (
            <div className={classNames(
                'sm-flex justify-space-between margin-left-16 width-160 border-default-black-5 border-radius-8 padding-vertical-4 padding-left-8',
                (disabled ? styles['extruder-item-disabled'] : '')
            )}
            >
                <span className="text-overflow-ellipsis">{i18n._(`key-Printing/LeftBar-${extruderLabelMap[status]}`)}</span>
                <div className="sm-flex">
                    {renderExtruderIcon(leftExtruderColor, rightExtruderColor)}
                    <SvgIcon
                        disabled={disabled}
                        type={['static']}
                        size={24}
                        hoversize={24}
                        color="#545659"
                        name="DropdownOpen"
                    />
                </div>
            </div>
        );
    };

    useEffect(() => {
        let newHelpersExtruder = cloneDeep(helpersExtruder);
        newHelpersExtruder = {
            ...newHelpersExtruder,
            multiple: newHelpersExtruder.support === newHelpersExtruder.adhesion ? newHelpersExtruder.support : BOTH_EXTRUDER_MAP_NUMBER
        };
        setHelpersExtruder(newHelpersExtruder);
    }, []);
    useEffect(() => {
        let tempInfillExtruder = '';
        let tempShellExtruder = '';
        if (selectedModelArray.length > 0) {
            let extruderConfig = selectedModelArray[0].extruderConfig;
            tempInfillExtruder = extruderConfig.infill;
            tempShellExtruder = extruderConfig.shell;
            if (selectedModelArray.length > 1) {
                for (const item of selectedModelArray.slice(1)) {
                    extruderConfig = item.extruderConfig;
                    if (extruderConfig.infill !== tempInfillExtruder && tempInfillExtruder !== BOTH_EXTRUDER_MAP_NUMBER) {
                        tempInfillExtruder = BOTH_EXTRUDER_MAP_NUMBER;
                    }
                    if (extruderConfig.shell !== tempShellExtruder && tempShellExtruder !== BOTH_EXTRUDER_MAP_NUMBER) {
                        tempShellExtruder = BOTH_EXTRUDER_MAP_NUMBER;
                    }
                    if (tempShellExtruder === BOTH_EXTRUDER_MAP_NUMBER && tempInfillExtruder === BOTH_EXTRUDER_MAP_NUMBER) {
                        break;
                    }
                }
            }
        }
        setModelsExtruder({
            multiple: tempInfillExtruder === tempShellExtruder ? tempInfillExtruder : BOTH_EXTRUDER_MAP_NUMBER,
            infill: tempInfillExtruder,
            shell: tempShellExtruder
        });
    }, [selectedModelArray]);

    useEffect(() => {
        const leftExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
        const rightExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        const newColorL = leftExtrualMaterial?.settings?.color?.default_value;
        const newColorR = rightExtrualMaterial?.settings?.color?.default_value;
        newColorL && setColorL(newColorL);
        newColorR && setColorR(newColorR);
    }, [materialDefinitions, defaultMaterialIdRight, defaultMaterialId]);

    useEffect(() => {
        window.addEventListener('change-extruder', onChangeExtruder);
        return () => {
            window.removeEventListener('change-extruder', onChangeExtruder);
        };
    }, []);
    return (
        <div
            className={classNames(styles['extruder-overlay'], 'position-absolute width-328 margin-left-72 border-default-grey-1 border-radius-8 background-color-white')}
            style={{
                marginTop: '320px'
            }}
        >
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16 height-40 sm-flex justify-space-between')}>
                {i18n._('key-Printing/LeftBar-Extruder')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-bottom-16 padding-top-8 padding-left-8">
                <div className="select-models-container">
                    {
                        modelExtruderInfoShow && (
                            <div className="sm-flex align-center justify-space-between margin-right-16">
                                <div className="sm-flex align-center">
                                    <SvgIcon
                                        color="#1890FF"
                                        size={24}
                                        type={['static']}
                                        name="WarningTipsTips"
                                        className="margin-vertical-8 margin-right-4"
                                    />
                                    <span className="display-inline width-200 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Selected Models Extruder Info')}</span>
                                </div>
                                <SvgIcon
                                    color="#545659"
                                    size={24}
                                    type={['static']}
                                    name="Cancel"
                                    className="margin-right-8"
                                    onClick={() => {
                                        dispatch(printingActions.updateState({ modelExtruderInfoShow: false }));
                                    }}
                                />
                            </div>
                        )
                    }
                    <div className="sm-flex align-center margin-top-8">
                        <SvgIcon
                            size={24}
                            hoversize={24}
                            type={['static']}
                            name={`${isOpenModels ? 'DropdownOpen' : 'DropdownClose'}`}
                            color="#545659"
                            onClick={() => handleOpen('models')}
                        />
                        <div role="presentation" onClick={() => handleOpen('models')} className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Selected Models')}</div>
                        <Dropdown
                            disabled={!isSelectedModelAllVisible}
                            placement="bottomRight"
                            overlay={extruderOverlay('models.multiple', modelsExtruder.multiple)}
                            trigger="click"
                        >
                            {renderExtruderStatus(modelsExtruder.multiple, !isSelectedModelAllVisible)}
                        </Dropdown>
                    </div>
                    <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenModels ? 'sm-flex' : 'display-none'}`}>
                        <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Shells')}</span>
                        <Dropdown
                            placement="bottomRight"
                            overlay={extruderOverlay('models.shell', modelsExtruder.shell)}
                            disabled={!isSelectedModelAllVisible}
                            trigger="click"
                        >
                            {renderExtruderStatus(modelsExtruder.shell, !isSelectedModelAllVisible)}
                        </Dropdown>
                    </div>
                    <div className={`sm-flex align-center margin-left-24 margin-top-8 ${isOpenModels ? 'sm-flex' : 'display-none'}`}>
                        <span className="display-block width-96 text-overflow-ellipsis margin-left-4">{i18n._('key-Printing/LeftBar-Infill')}</span>
                        <Dropdown
                            disabled={!isSelectedModelAllVisible}
                            placement="bottomRight"
                            overlay={extruderOverlay('models.infill', modelsExtruder.infill)}
                            trigger="click"
                        >
                            {renderExtruderStatus(modelsExtruder.infill, !isSelectedModelAllVisible)}
                        </Dropdown>
                    </div>
                </div>
            </div>
        </div>
    );
});

ExtruderOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired
};

export default ExtruderOverlay;
