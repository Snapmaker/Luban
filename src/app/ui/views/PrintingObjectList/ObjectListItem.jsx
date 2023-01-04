import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useMemo } from 'react';

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

function getExtrudersUsed(numbers) {
    const s = new Set(numbers);
    if (s.has('2')) {
        s.delete('2');
        s.add('0');
        s.add('1');
    }
    return Array.from(s);
}

/**
 * Map extruder numbers to all colors used.
 *
 * @param numbers
 * @param extruderColors
 */
function getColorsUsed(numbers, extruderColors) {
    const extrudersUsed = getExtrudersUsed(numbers);

    const colors = [];
    for (const nr of extrudersUsed) {
        colors.push(extruderColors[nr]);
    }
    return colors;
}

export const renderExtruderIcon = (extrudersUsed, colorsUsed) => {
    const useLeftExtruderOnly = extrudersUsed.length === 1 && extrudersUsed[0] === '0';
    const useRightExtruderOnly = extrudersUsed.length === 1 && extrudersUsed[0] === '1';
    // TODO: remove the ugly 2 for mixed colors
    const useBothExtruders = extrudersUsed.length > 1 || extrudersUsed.length === 1 && extrudersUsed[0] === '2';

    const leftExtruderColor = colorsUsed[0];
    const rightExtruderColor = colorsUsed[1] || colorsUsed[0];

    return (
        <div className={classNames('height-24', styles['extruder-icon'])}>
            <div className={classNames('width-24 height-24 display-inline')}>
                <div className="position-re">
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
            <span className="margin-right-4">
                {useLeftExtruderOnly && 'L'}
                {useRightExtruderOnly && 'R'}
                {useBothExtruders && '&'}
            </span>
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
        <Menu selectedKeys={selectExtruder ? [selectExtruder] : []}>
            <Menu.Item
                key="L"
                onClick={() => onChange({ type, direction: '0' })}
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder L')}</span>
                    {colorL !== whiteHex ? (
                        <SvgIcon name="Extruder" size={24} color={colorL} type={['static']} />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
            <Menu.Item
                key="R"
                onClick={() => onChange({ type, direction: '1' })}
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder R')}</span>
                    {colorR !== whiteHex ? (
                        <SvgIcon name="Extruder" size={24} color={colorR} type={['static']} />
                    ) : (
                        <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                    )}
                </div>
            </Menu.Item>
        </Menu>
    );
};

const extruderOverlayMenu2 = ({ colorL, colorR, shell = '0', infill = '0', onChange }) => {
    const selectedKeys = [];

    const multiple = shell === infill ? shell : 'mixed';

    shell = shell !== '2' ? shell : 'mixed';
    infill = infill !== '2' ? infill : 'mixed';

    selectedKeys.push(`multiple-${multiple}`);
    selectedKeys.push(`shell-${shell}`);
    selectedKeys.push(`infill-${infill}`);

    function generateGroup({ title, keyPrefix }) {
        return (
            <Menu.ItemGroup title={title}>
                <Menu.Item
                    key={`${keyPrefix}-0`}
                    onClick={() => onChange({ type: keyPrefix, direction: '0' })}
                >
                    <div className="sm-flex justify-space-between">
                        <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder L')}</span>
                        {colorL !== whiteHex ? (
                            <SvgIcon name="Extruder" size={24} color={colorL} type={['static']} />
                        ) : (
                            <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                        )}
                    </div>
                </Menu.Item>
                <Menu.Item
                    key={`${keyPrefix}-1`}
                    onClick={() => onChange({ type: keyPrefix, direction: '1' })}
                >
                    <div className="sm-flex justify-space-between">
                        <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder R')}</span>
                        {colorR !== whiteHex ? (
                            <SvgIcon name="Extruder" size={24} color={colorR} type={['static']} />
                        ) : (
                            <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                        )}
                    </div>
                </Menu.Item>
                <Menu.Item
                    key={`${keyPrefix}-mixed`}
                    disabled
                >
                    <div className="sm-flex justify-space-between">
                        <span className="display-inline width-96 text-overflow-ellipsis">{i18n._('key-Printing/LeftBar-Extruder Both')}</span>
                        <div className="position-re">
                            {colorL !== whiteHex ? (
                                <SvgIcon className="position-absolute right-1" name="ExtruderLeft" size={24} color={colorL} type={['static']} />
                            ) : (
                                <img className="position-absolute right-1" src="/resources/images/24x24/icon_extruder_white_left_24x24.svg" alt="" />
                            )}
                            {colorR !== whiteHex ? (
                                <SvgIcon className="position-absolute right-1" name="ExtruderRight" size={24} color={colorR} type={['static']} />
                            ) : (
                                <img className="position-absolute right-1" src="/resources/images/24x24/icon_extruder_white_right_24x24.svg" alt="" />
                            )}
                        </div>
                    </div>
                </Menu.Item>
            </Menu.ItemGroup>
        );
    }

    return (
        <Menu selectedKeys={selectedKeys}>
            {
                generateGroup({
                    title: i18n._('key-Printing/LeftBar-Selected Models'),
                    keyPrefix: 'multiple',
                })
            }
            {
                generateGroup({
                    title: i18n._('key-Printing/LeftBar-Shells'),
                    keyPrefix: 'shell',
                })
            }
            {
                generateGroup({
                    title: i18n._('key-Printing/LeftBar-Infill'),
                    keyPrefix: 'infill',
                })
            }
        </Menu>
    );
};

function ObjectListItem(
    {
        depth = 1,
        model,
        isSelected,
        onSelect,
        onToggleVisible,
        disabled = false,
        extruderCount = 1,
        leftMaterialColor = whiteHex,
        rightMaterialColor = whiteHex,
        updateSelectedModelsExtruder,
    }
) {
    const [tipVisible, setTipVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const extrudersUsed = useMemo(() => {
        return getExtrudersUsed([
            model.extruderConfig.shell,
            model.extruderConfig.infill,
        ]);
    }, [model.extruderConfig.shell, model.extruderConfig.infill]);

    const colorsUsed = useMemo(() => {
        return getColorsUsed(
            [model.extruderConfig.shell, model.extruderConfig.infill],
            [leftMaterialColor, rightMaterialColor],
        );
    }, [model.extruderConfig.shell, model.extruderConfig.infill, leftMaterialColor, rightMaterialColor]);

    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(model.modelName, suffixLength);

    const getModelExtruderOverlayMenu = () => {
        return extruderOverlayMenu2({
            colorL: leftMaterialColor,
            colorR: rightMaterialColor,
            shell: model.extruderConfig.shell,
            infill: model.extruderConfig.infill,
            onChange: ({ type, direction }) => {
                updateSelectedModelsExtruder(type, direction);
            },
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
                            placement="right"
                            onVisibleChange={() => {
                                if (!isSelected) {
                                    // if we select a unselected model, then cancel current selection and select it
                                    onSelect(model);
                                }
                            }}
                            overlay={getModelExtruderOverlayMenu()}
                            trigger={['click']}
                            disabled={extruderCount === 1}
                        >
                            {renderExtruderIcon(extrudersUsed, colorsUsed)}
                        </Dropdown>
                        <SvgIcon
                            name={model.visible ? 'ShowNormal' : 'HideNormal'}
                            title={model.visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                            color={model.visible ? '#545659' : '#B9BCBF'}
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
                                        isSelected={child.isSelected}
                                        onSelect={onSelect}
                                        onToggleVisible={onToggleVisible}
                                        disabled={disabled}
                                        extruderCount={extruderCount}
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
    isSelected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onToggleVisible: PropTypes.func.isRequired,
    disabled: PropTypes.bool,

    // extruder related
    extruderCount: PropTypes.number,
    leftMaterialColor: PropTypes.string,
    rightMaterialColor: PropTypes.string,
    updateSelectedModelsExtruder: PropTypes.func
};

export default ObjectListItem;
