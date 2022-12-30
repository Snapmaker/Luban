import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import i18n from '../../../lib/i18n';
import { normalizeNameDisplay } from '../../../lib/normalize-range';
import Anchor from '../../components/Anchor';
import Dropdown from '../../components/Dropdown';
import SvgIcon from '../../components/SvgIcon';
import TipTrigger from '../../components/TipTrigger';
import Menu from '../../components/Menu';
import ObjectSvgIcon from './ObjectSvgIcon';
import styles from './styles.styl';

export const whiteHex = '#ffffff';

/**
 * Map extruder numbers to all colors used.
 *
 * @param numbers
 * @param extruderColors
 */
function getColorsUsed(numbers, extruderColors) {
    const n = extruderColors.length;

    let opt = 0;
    for (const nr of numbers) {
        if (nr === '0') {
            opt |= 1;
        }
        if (nr === '1') {
            opt |= 2;
        }
        if (opt === (1 << n) - 1) {
            break;
        }
    }

    const colors = [];
    for (let i = 0; i < n; i++) {
        if (opt & (1 << i)) {
            colors.push(extruderColors[i]);
        }
    }
    return colors;
}

export const renderExtruderIcon = (leftExtruderColor, rightExtruderColor) => {
    rightExtruderColor = rightExtruderColor || leftExtruderColor;
    return (
        <div className={classNames('height-24', styles['extruder-icon'])}>
            <div className={classNames('width-24 height-24 display-inline')}>
                <div className="position-re ">
                    {leftExtruderColor !== whiteHex ? (
                        <SvgIcon
                            color={leftExtruderColor}
                            size={24}
                            name="ExtruderLeft"
                            type={['static']}
                            className="position-absolute"
                        />
                    ) : (
                        <img className="position-absolute" src="/resources/images/24x24/icon_extruder_white_left_24x24.svg" alt="" />
                    )}
                    {rightExtruderColor !== whiteHex ? (
                        <SvgIcon
                            color={rightExtruderColor}
                            size={24}
                            name="ExtruderRight"
                            type={['static']}
                            className="position-absolute right-1"
                        />
                    ) : (
                        <img className="position-absolute" src="/resources/images/24x24/icon_extruder_white_right_24x24.svg" alt="" />
                    )}
                </div>
            </div>
            <div className={classNames('display-none', styles['hover-tip'])}>
                <SvgIcon
                    name="DropdownLine"
                    size={12}
                    type={['static']}
                />
            </div>
        </div>
    );
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

function ObjectListItem(
    {
        depth = 1,
        model,
        isSelected,
        onSelect,
        visible,
        onToggleVisible,
        disabled = false,
        isDualExtruder = false,
        leftMaterialColor = whiteHex,
        rightMaterialColor = whiteHex,
        updateSelectedModelsExtruder,
    }
) {
    const [tipVisible, setTipVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const colorsUsed = getColorsUsed([model.extruderConfig.shell, model.extruderConfig.infill], [leftMaterialColor, rightMaterialColor]);
    console.log('colorsUsed =', colorsUsed);

    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(model.modelName, suffixLength);

    const getExtruderOverlayMenu = (colorL, colorR, extruderConfig) => {
        const selectExtruder = (() => {
            if (extruderConfig.shell === extruderConfig.infill) {
                switch (extruderConfig.infill.toString()) {
                    case '0':
                        return 'L';
                    case '1':
                        return 'R';
                    default:
                        return null;
                }
            }
            return null;
        })();

        return extruderOverlayMenu({
            type: 'models.multiple',
            colorL: colorL,
            colorR: colorR,
            onChange: ({ direction }) => {
                updateSelectedModelsExtruder(direction);
            },
            selectExtruder: selectExtruder
        });
    };

    const hasChildren = model.children && !!model.children?.length;

    return (
        <div className={classNames(styles['object-list-item'])}>
            <TipTrigger
                key={model.modelID}
                title={i18n._('key-PrintingCncLaser/ObjectList-Object')}
                content={model.modelName}
                placement="right"
                visible={!hasChildren && tipVisible}
            >
                <div
                    className={classNames(
                        styles['object-list-item-cell'],
                        'padding-vertical-4',
                        'padding-right-8',
                        'sm-flex',
                        {
                            [styles.selected]: isSelected,
                        },
                    )}
                    style={{
                        paddingLeft: `${8 + 24 * (depth - 1)}px`
                    }}
                >
                    {
                        hasChildren ? (
                            <SvgIcon
                                type={['static']}
                                name={isExpanded ? 'DropdownOpen' : 'DropdownClose'}
                                className="margin-right-4"
                                disabled={disabled}
                                onClick={() => setIsExpanded((prev) => !prev)}
                            />
                        ) : (
                            <ObjectSvgIcon
                                iconName="ObjectList3d"
                                model={model}
                                disabled={disabled}
                            />
                        )
                    }
                    <Anchor
                        className={classNames(
                            'height-24',
                            'sm-flex-width',
                            'sm-flex'
                        )}
                        style={{ color: disabled ? '#D5D6D9' : '' }}
                        onClick={(event) => onSelect(model, event)}
                        onMouseEnter={() => {
                            setTipVisible(true);
                        }}
                        onMouseLeave={() => {
                            setTipVisible(false);
                        }}
                    >
                        <span className={classNames(styles['prefix-name'])}>
                            {prefixName}
                        </span>
                        <span className={classNames(styles['suffix-name'])}>
                            {suffixName}
                        </span>
                    </Anchor>
                    <div className="sm-flex">
                        <Dropdown
                            disabled={!isDualExtruder}
                            placement="right"
                            onVisibleChange={() => {
                                onSelect(model);
                            }}
                            overlay={getExtruderOverlayMenu(leftMaterialColor, rightMaterialColor, model.extruderConfig)}
                            trigger={['click']}
                        >
                            {renderExtruderIcon(...colorsUsed)}
                        </Dropdown>
                        <span className="margin-horizontal-4">
                            L
                        </span>
                        <SvgIcon
                            name={visible ? 'ShowNormal' : 'HideNormal'}
                            title={visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                            color={visible ? '#545659' : '#B9BCBF'}
                            onClick={() => onToggleVisible(model)}
                            disabled={disabled}
                            type={['static']}
                        />
                    </div>
                </div>
            </TipTrigger>

            {
                isExpanded && (
                    // wrap children in a div
                    <div>
                        {
                            model.children && !!model.children.length && model.children.map((child) => {
                                return (
                                    <ObjectListItem
                                        depth={depth + 1}
                                        model={child}
                                        key={child.modelID}
                                        visible={child.visible}
                                        isSelected={child.isSelected}
                                        onSelect={onSelect}
                                        onToggleVisible={onToggleVisible}
                                        disabled={disabled}
                                        isDualExtruder={isDualExtruder}
                                        leftMaterialColor={leftMaterialColor}
                                        rightMaterialColor={rightMaterialColor}
                                        updateSelectedModelsExtruder={updateSelectedModelsExtruder}
                                    />
                                );
                            })
                        }
                    </div>
                )
            }
        </div>
    );
}

ObjectListItem.propTypes = {
    depth: PropTypes.number,
    model: PropTypes.object.isRequired,
    visible: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onToggleVisible: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    isDualExtruder: PropTypes.bool,
    leftMaterialColor: PropTypes.string,
    rightMaterialColor: PropTypes.string,
    updateSelectedModelsExtruder: PropTypes.func
};

export default ObjectListItem;
