import classNames from 'classnames';
import path from 'path';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import { HEAD_PRINTING } from '../../constants';
import i18n from '../../lib/i18n';
import { normalizeNameDisplay } from '../../lib/normalize-range';
import Anchor from '../components/Anchor';
import SvgIcon from '../components/SvgIcon';
import TipTrigger from '../components/TipTrigger';

let svgName = '';
let modelName = '';
const objectList3d = 'ObjectList3d';
const objectListShape = 'ObjectListShape';
const objectListPicture = 'ObjectListPicture';
let isPrinting = false;

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

    return Icon;
};
ModelIcon.propTypes = {
    model: PropTypes.object.isRequired,
    disabled: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
};

function ModelItem({
    model, visible, isSelected, styles, onSelect, onToggleVisible,
    inProgress, placement, disabled = false,
}) {
    const [tipTriggerVisible, setTipVisible] = useState('');

    if (!model) {
        return null;
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

    const hasChildren = model.children && !!model.children?.length;

    return (
        <div>
            <TipTrigger
                key={model.modelID}
                title={i18n._('key-PrintingCncLaser/ObjectList-Object')}
                content={model.modelName}
                placement={placement || undefined}
                visible={!hasChildren && model.modelID === tipTriggerVisible && tipTriggerVisible}
            >
                {
                    !isPrinting && (
                        <div
                            className={classNames(
                                'padding-vertical-4',
                                'padding-horizontal-8',
                                'sm-flex',
                                styles['object-list-item'],
                                {
                                    [styles.selected]: isSelected,
                                },
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
                                onMouseEnter={() => {
                                    setTipVisible(true);
                                }}
                                onMouseLeave={() => {
                                    setTipVisible(false);
                                }}
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
                    )
                }
            </TipTrigger>
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
    placement: PropTypes.string,
};

export default React.memo(ModelItem);
