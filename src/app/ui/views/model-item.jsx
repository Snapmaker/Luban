import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import path from 'path';
import i18n from '../../lib/i18n';
import TipTrigger from '../components/TipTrigger';
import Anchor from '../components/Anchor';
import SvgIcon from '../components/SvgIcon';
import { normalizeNameDisplay } from '../../lib/normalize-range';
import { HEAD_PRINTING } from '../../constants';
import { renderExtruderIcon, whiteHex } from '../widgets/PrintingVisualizer/VisualizerLeftBar';

let svgName = '';
let modelName = '';
const objectList3d = 'ObjectList3d';
const objectListShape = 'ObjectListShape';
const objectListPicture = 'ObjectListPicture';
let isPrinting = false;
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

const ModelIcon = (props) => {
    const { model, disabled, name } = props;
    const Icon = (
        <SvgIcon
            type={['static']}
            color={model.needRepair ? '#FFA940' : ''}
            name={model.needRepair ? 'WarningTipsWarningBig' : name}
            className="margin-right-4"
            disabled={disabled}
        />
    );
    if (model.needRepair) {
        return (
            <TipTrigger
                key={model.modelID}
                content={i18n._('key-PrintingCncLaser/ObjectList-Error model, select it and click repair model button to repair it')}
                visible={model.needRepair}
                placement="bottom"
            >
                {Icon}
            </TipTrigger>
        );
    } else {
        return Icon;
    }
};
ModelIcon.propTypes = {
    model: PropTypes.object.isRequired,
    disabled: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
};

function ModelItem({
    model, visible, isSelected, styles, onSelect, onToggleVisible,
    inProgress, placment, disabled = false, isDualExtruder = false,
    leftMaterialColor = whiteHex, rightMaterialColor = whiteHex,
    isExpend, onExpend
}) {
    if (!model) {
        return null;
    }

    if (model.headType === '3dp' || model.headType === HEAD_PRINTING) {
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
    }
    // TODO: '3dp' for project file of "< version 4.1"
    if (model.headType === '3dp' || model.headType === HEAD_PRINTING) {
        isPrinting = true;
        modelName = path.basename(model.modelName);
        svgName = objectList3d;
    } else {
        const taskInfo = model.getTaskInfo();
        isPrinting = false;
        modelName = taskInfo.modelName;
        svgName = (() => {
            if (taskInfo.sourceType === 'text') {
                return objectListShape;
            }
            if (taskInfo.mode !== 'vector') {
                return objectListPicture;
            }
            return objectListShape;
        })();
    }
    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(modelName, suffixLength);
    return (
        <div>
            <TipTrigger
                key={model.modelID}
                title={i18n._('key-PrintingCncLaser/ObjectList-Object')}
                content={model.modelName}
                placement={placment || undefined}
            >
                {!isPrinting ? (
                    <div
                        className={classNames(
                            'padding-vertical-4',
                            'padding-horizontal-8',
                            'sm-flex',
                            styles.objectListItem,
                            isSelected ? styles.selected : null,
                        )}
                    >
                        <Anchor
                            className={classNames(
                                'height-24',
                                'sm-flex-width',
                                'sm-flex'
                            )}
                            style={{ color: disabled ? '#D5D6D9' : '' }}
                            onClick={(event) => onSelect(model, event)}
                        >

                            <ModelIcon name={svgName} model={model} disabled={disabled} />

                            <span className={classNames(styles['prefix-name'])}>
                                {prefixName}
                            </span>
                            <span className={classNames(styles['suffix-name'])}>
                                {suffixName}
                            </span>
                        </Anchor>
                        <SvgIcon
                            name={visible ? 'ShowNormal' : 'HideNormal'}
                            title={visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                            color={visible ? '#545659' : '#B9BCBF'}
                            onClick={() => onToggleVisible(model)}
                            disabled={inProgress || disabled}
                            // type={isSelected ? ['static'] : ['hoverNormal', 'pressNormal']}
                            type={['static']}
                        />
                    </div>
                ) : (
                    <div
                        className={classNames(
                            'padding-vertical-4',
                            'padding-horizontal-8',
                            'sm-flex',
                            styles.objectListItem,
                            isSelected ? styles.selected : null,
                        )}
                    >
                        <Anchor
                            className={classNames(
                                'height-24',
                                'sm-flex-width',
                                'sm-flex'
                            )}
                            style={{ color: disabled ? '#D5D6D9' : '' }}
                            onClick={(event) => onSelect(model, event)}
                        >
                            {(model.children && !!model.children?.length) ? (
                                <SvgIcon
                                    type={['static']}
                                    name={isExpend ? 'DropdownOpen' : 'DropdownClose'}
                                    className="margin-right-4"
                                    disabled={disabled}
                                    onClick={() => onExpend(model.modelID)}
                                />
                            ) : (
                                <ModelIcon name={svgName} model={model} disabled={disabled} />
                            )}
                            <span className={classNames(styles['prefix-name'])}>
                                {prefixName}
                            </span>
                            <span className={classNames(styles['suffix-name'])}>
                                {suffixName}
                            </span>
                        </Anchor>
                        <div className="sm-flex">
                            <>
                                {renderExtruderIcon(leftExtruderColor, rightExtruderColor)}
                            </>
                            <SvgIcon
                                name={visible ? 'ShowNormal' : 'HideNormal'}
                                title={visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                                color={visible ? '#545659' : '#B9BCBF'}
                                onClick={() => onToggleVisible(model)}
                                disabled={inProgress || disabled}
                                // type={isSelected ? ['static'] : ['hoverNormal', 'pressNormal']}
                                type={['static']}
                            />
                        </div>
                    </div>
                )}
            </TipTrigger>
            {isExpend && model.children && !!model.children.length && model.children.map((modelItem) => {
                const { prefixName: _prefixName, suffixName: _suffixName } = normalizeNameDisplay(modelItem.modelName, suffixLength);
                const { shell, infill } = modelItem.extruderConfig;
                const { _leftExtruderColor, _rightExtruderColor } = getExtruderColor(shell, infill, leftMaterialColor, rightMaterialColor);
                return (
                    <TipTrigger
                        key={modelItem.modelID}
                        title={i18n._('key-PrintingCncLaser/ObjectList-Object')}
                        content={modelItem.modelName}
                        placement={placment || undefined}
                    >
                        <div
                            className={classNames(
                                'padding-vertical-4',
                                'padding-right-8',
                                'padding-left-36',
                                'sm-flex',
                                styles.objectListItem,
                                modelItem.isSelected ? styles.selected : null,
                            )}
                        >
                            <Anchor
                                className={classNames(
                                    'height-24',
                                    'sm-flex-width',
                                    'sm-flex'
                                )}
                                style={{ color: disabled ? '#D5D6D9' : '' }}
                                onClick={(event) => onSelect(modelItem, event)}
                            >
                                <ModelIcon name={objectList3d} model={modelItem} disabled={disabled} />

                                <span className={classNames(styles['prefix-name'])}>
                                    {_prefixName}
                                </span>
                                <span className={classNames(styles['suffix-name'])}>
                                    {_suffixName}
                                </span>
                            </Anchor>
                            <div className="sm-flex">
                                <>
                                    {renderExtruderIcon(_leftExtruderColor, _rightExtruderColor)}
                                </>
                                <SvgIcon
                                    name={modelItem.visible ? 'ShowNormal' : 'HideNormal'}
                                    title={modelItem.visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                                    color={modelItem.visible ? '#545659' : '#B9BCBF'}
                                    onClick={() => onToggleVisible(modelItem)}
                                    disabled={inProgress || disabled}
                                    // type={isSelected ? ['static'] : ['hoverNormal', 'pressNormal']}
                                    type={['static']}
                                />
                            </div>
                        </div>
                    </TipTrigger>
                );
            })}
        </div>
    );
}
ModelItem.propTypes = {
    model: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired,
    visible: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onToggleVisible: PropTypes.func.isRequired,
    inProgress: PropTypes.bool.isRequired,
    disabled: PropTypes.bool,
    placment: PropTypes.string,
    isDualExtruder: PropTypes.bool,
    leftMaterialColor: PropTypes.string,
    rightMaterialColor: PropTypes.string,
    isExpend: PropTypes.bool,
    onExpend: PropTypes.func
};

export default React.memo(ModelItem);
