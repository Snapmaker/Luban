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

let svgName = '';
let modelName = '';
const objectList3d = 'ObjectList3d';
const objectListShape = 'ObjectListShape';
const objectListPicture = 'ObjectListPicture';
function ModelItem({ model, visible, isSelected, styles, onSelect, onToggleVisible, inProgress, placment, disabled }) {
    if (!model) {
        return null;
    }

    // TODO: '3dp' for project file of "< version 4.1"
    if (model.headType === '3dp' || model.headType === HEAD_PRINTING) {
        modelName = path.basename(model.modelName);
        svgName = objectList3d;
    } else {
        const taskInfo = model.getTaskInfo();
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
        <TipTrigger
            key={model.modelName}
            title={i18n._('Object')}
            content={model.modelName}
            placement={placment || undefined}
        >
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
                    <SvgIcon
                        type={['static']}
                        name={svgName}
                        className="margin-right-4"
                        disabled={disabled}
                    />
                    <span className={classNames(styles['prefix-name'])}>
                        {prefixName}
                    </span>
                    <span className={classNames(styles['suffix-name'])}>
                        {suffixName}
                    </span>
                </Anchor>
                <SvgIcon
                    name={visible ? 'ShowNormal' : 'HideNormal'}
                    title={visible ? i18n._('Hide') : i18n._('Show')}
                    color={visible ? '#545659' : '#B9BCBF'}
                    onClick={() => onToggleVisible(model)}
                    disabled={inProgress || disabled}
                    // type={isSelected ? ['static'] : ['hoverNormal', 'pressNormal']}
                    type={['static']}
                />
            </div>
        </TipTrigger>
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
    disabled: PropTypes.bool.isRequired,
    placment: PropTypes.string
};

export default React.memo(ModelItem);
