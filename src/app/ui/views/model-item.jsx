import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import path from 'path';
import i18n from '../../lib/i18n';
import TipTrigger from '../components/TipTrigger';
import Anchor from '../components/Anchor';
import SvgIcon from '../components/SvgIcon';
import { normalizeNameDisplay } from '../../lib/normalize-range';

function ModelItem({ model, visible, isSelected, styles, onSelect, onToggleVisible, inProgress }) {
    if (!model) {
        return null;
    }
    let modelName = '';
    let modelIcon = '';
    if (model.headType === '3dp') {
        modelName = path.basename(model.modelName);
        modelIcon = styles.iconShape;
    } else {
        const taskInfo = model.getTaskInfo();
        modelName = taskInfo.modelName;
        modelIcon = (() => {
            if (taskInfo.sourceType === 'text') {
                return styles.iconText;
            }
            if (taskInfo.mode !== 'vector') {
                return styles.iconPic;
            }
            return styles.iconShape;
        })();
    }
    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(modelName, suffixLength);

    return (
        <TipTrigger
            key={model.modelName}
            title={i18n._('Object')}
            content={model.modelName}
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
                    onClick={(event) => onSelect(model, event.shiftKey)}
                >
                    <span
                        className={classNames(
                            'height-24',
                            'width-24',
                            styles.icon,
                            modelIcon
                        )}
                    />
                    <span>
                        {prefixName}
                    </span>
                    <span>
                        {suffixName}
                    </span>
                </Anchor>
                <SvgIcon
                    name={visible ? 'ShowNormal' : 'HideNormal'}
                    title={visible ? i18n._('Hide') : i18n._('Show')}
                    color={visible ? '#545659' : '#B9BCBF'}
                    onClick={() => onToggleVisible(model)}
                    disabled={inProgress}
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
    inProgress: PropTypes.bool.isRequired
};

export default React.memo(ModelItem);
