import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import i18n from '../../../lib/i18n';
import { normalizeNameDisplay } from '../../../lib/normalize-range';
import Anchor from '../../components/Anchor';
import Dropdown from '../../components/Dropdown';
import SvgIcon from '../../components/SvgIcon';
import TipTrigger from '../../components/TipTrigger';

import { extruderOverlayMenu } from '../../widgets/PrintingVisualizer/Overlay/ExtruderOverlay';
import { renderExtruderIcon, whiteHex } from '../../widgets/PrintingVisualizer/VisualizerLeftBar';
import ObjectSvgIcon from './ObjectSvgIcon';
import styles from './styles.styl';

let leftExtruderColor = whiteHex;
let rightExtruderColor = whiteHex;
const getExtruderColor = (shell, infill, leftMaterialColor, rightMaterialColor) => {
    let _leftExtruderColor = whiteHex;
    let _rightExtruderColor = whiteHex;
    if (shell === infill) {
        switch (shell) {
            case '0':
                _leftExtruderColor = leftMaterialColor;
                _rightExtruderColor = leftMaterialColor;
                break;
            case '1':
                _leftExtruderColor = rightMaterialColor;
                _rightExtruderColor = rightMaterialColor;
                break;
            case '2':
                _leftExtruderColor = leftMaterialColor;
                _rightExtruderColor = rightMaterialColor;
                break;
            default:
                break;
        }
    } else {
        _leftExtruderColor = leftMaterialColor;
        _rightExtruderColor = rightMaterialColor;
    }
    return {
        _leftExtruderColor,
        _rightExtruderColor
    };
};

function ObjectListItem(
    {
        depth = 1,
        model,
        isSelected,
        onSelect,
        visible,
        onToggleVisible,
        inProgress,
        disabled = false,
        isDualExtruder = false,
        leftMaterialColor = whiteHex,
        rightMaterialColor = whiteHex,
        updateSelectedModelsExtruder,
    }
) {
    const [tipVisible, setTipVisible] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    if (isDualExtruder) {
        const { extruderConfig: { shell, infill } } = model;
        const { _leftExtruderColor, _rightExtruderColor } = getExtruderColor(shell, infill, leftMaterialColor, rightMaterialColor);
        leftExtruderColor = _leftExtruderColor;
        rightExtruderColor = _rightExtruderColor;
    } else {
        const { extruderConfig: { shell, infill } } = model;
        const { _leftExtruderColor } = getExtruderColor(shell, infill, leftMaterialColor, rightMaterialColor);
        // left = right, when single extruder
        leftExtruderColor = _leftExtruderColor;
        rightExtruderColor = _leftExtruderColor;
    }

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
                            {renderExtruderIcon(leftExtruderColor, rightExtruderColor)}
                        </Dropdown>
                        <SvgIcon
                            name={visible ? 'ShowNormal' : 'HideNormal'}
                            title={visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                            color={visible ? '#545659' : '#B9BCBF'}
                            onClick={() => onToggleVisible(model)}
                            disabled={inProgress || disabled}
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
                                        inProgress={inProgress}
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
    inProgress: PropTypes.bool.isRequired,
    disabled: PropTypes.bool,
    isDualExtruder: PropTypes.bool,
    leftMaterialColor: PropTypes.string,
    rightMaterialColor: PropTypes.string,
    updateSelectedModelsExtruder: PropTypes.func
};

export default ObjectListItem;
