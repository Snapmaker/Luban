// import React, { PureComponent } from 'react';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import path from 'path';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../flux/printing';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { limitStringLength } from '../../lib/normalize-range';

const PrintingObjectListBox = (props) => {
    const selectedModelIDArray = useSelector(state => state?.printing?.modelGroup?.selectedModelIDArray);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const dispatch = useDispatch();
    const selectTargetModel = (model, shiftKey) => {
        dispatch(printingActions.selectTargetModel(model, shiftKey));
    };

    function onClickHideShowSelectedModel(model) {
        const visible = model.visible;
        selectTargetModel(model);
        if (visible === true) {
            dispatch(printingActions.hideSelectedModel());
        } else {
            dispatch(printingActions.showSelectedModel());
        }
    }
    useEffect(() => {
        props.setTitle(i18n._('Object List'));
    }, []); // << super important array

    return (
        <div className={styles['object-list-box']}>
            {(models) && models.filter(model => !model.supportTag).map((model) => {
                const modelName = path.basename(model.modelName);
                const displayModelName = limitStringLength(modelName, 36);
                return (
                    <TipTrigger
                        key={model.modelID}
                        title={i18n._('Object')}
                        content={model.modelName}
                    >
                        <div
                            className={classNames(
                                styles['object-list-item'],
                                selectedModelIDArray.length > 0 && selectedModelIDArray.indexOf(model.modelID) >= 0 ? styles.selected : null,
                            )}
                        >
                            <Anchor
                                className={classNames(styles.name, styles.bt)}
                                onClick={(event) => selectTargetModel(model, event.shiftKey)}
                            >
                                <span className={classNames(styles.icon, styles['icon-shape'])} />
                                <span>{displayModelName}</span>
                            </Anchor>
                            <button
                                type="button"
                                className={classNames(
                                    styles.icon,
                                    model.visible ? styles.iconHideOpen : styles.iconHideClose,
                                    styles.bt
                                )}
                                onClick={() => onClickHideShowSelectedModel(model)}
                            />
                        </div>
                    </TipTrigger>
                );
            })}
        </div>
    );
};

PrintingObjectListBox.propTypes = {
    setTitle: PropTypes.func
};
export default PrintingObjectListBox;
