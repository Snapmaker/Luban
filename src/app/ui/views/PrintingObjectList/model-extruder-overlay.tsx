// @ts-ignore
import React from 'react';

import i18n from '../../../lib/i18n';
import { BOTH_EXTRUDER_MAP_NUMBER } from '../../../constants';
import SvgIcon from '../../components/SvgIcon';
import Menu from '../../components/Menu';
import styles from './styles.styl';

const whiteHex = '#ffffff';

/**
 * Generic Overlay for extruder config.
 *
 * Supports 0/1 selection.
 */
export const getExtruderConfigOverlay = ({ key, selectedExtruder, colorL, colorR, onChange }) => {
    const selectedKeys = [];
    selectedKeys.push(`extruder-${selectedExtruder}`);

    return (
        <Menu selectedKeys={selectedKeys}>
            <Menu.Item
                key={`${key}-0`}
                onClick={() => onChange({ key, direction: '0' })}
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
                key={`${key}-1`}
                onClick={() => onChange({ key, direction: '1' })}
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
 * Item Group (vertical).
 *
 * onChange: ({ type: key, direction: '0' | '1' })
 */
function generateMenuItemGroup(
    {
        key,
        title,
        colorL,
        colorR,
        onChange,
        showMixedOption = true, // show mixed option
    }
) {
    return (
        <Menu.ItemGroup title={title}>
            <Menu.Item
                key={`${key}-0`}
                onClick={() => onChange({ key, direction: '0' })}
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
                key={`${key}-1`}
                onClick={() => onChange({ key, direction: '1' })}
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
            {
                showMixedOption && (
                    <Menu.Item
                        key={`${key}-mixed`}
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
                )
            }
        </Menu.ItemGroup>
    );
}

/**
 * Overlay for model extruder config.
 *
 * Contains shell and infill config:
 * {
 *    shell: '0',
 *    infill: '0',
 * }
 */
export const getModelExtruderOverlay = (
    {
        shellExtruder = '0',
        infillExtruder = '0',
        colorL,
        colorR,
        onChange,
    }
) => {
    const selectedKeys = [];

    selectedKeys.push(`shell-${shellExtruder}`);
    selectedKeys.push(`infill-${infillExtruder}`);

    const combinedExtruder = shellExtruder === infillExtruder ? shellExtruder : BOTH_EXTRUDER_MAP_NUMBER;
    selectedKeys.push(`combined-${combinedExtruder}`);

    return (
        <Menu className={styles['dropdown-menu-horizontal']} selectedKeys={selectedKeys}>
            {
                generateMenuItemGroup({
                    title: i18n._('key-Printing/LeftBar-Selected Models'),
                    key: 'combined',
                    colorL,
                    colorR,
                    onChange,
                })
            }
            {
                generateMenuItemGroup({
                    title: i18n._('key-Printing/LeftBar-Shells'),
                    key: 'shell',
                    colorL,
                    colorR,
                    onChange,
                })
            }
            {
                generateMenuItemGroup({
                    title: i18n._('key-Printing/LeftBar-Infill'),
                    key: 'infill',
                    colorL,
                    colorR,
                    onChange,
                })
            }
        </Menu>
    );
};

/**
 * Overlay for support extruder config.
 */
export const getSupportExtruderOverlay = (
    {
        supportExtruder = '0',
        supportInterfaceExtruder = '0',
        colorL,
        colorR,
        onChange,
    }
) => {
    const selectedKeys = [];
    selectedKeys.push(`support-${supportExtruder}`);
    selectedKeys.push(`support.interface-${supportInterfaceExtruder}`);

    return (
        <Menu className={styles['dropdown-menu-horizontal']} selectedKeys={selectedKeys}>
            {
                generateMenuItemGroup({
                    title: i18n._('key-Printing/LeftBar-Support'),
                    key: 'support',
                    colorL,
                    colorR,
                    onChange,
                    showMixedOption: false,
                })
            }
            {
                generateMenuItemGroup({
                    title: i18n._('key-Printing/Term-Interface'),
                    key: 'support.interface',
                    colorL,
                    colorR,
                    onChange,
                    showMixedOption: false,
                })
            }
        </Menu>
    );
};
