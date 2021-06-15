import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { includes } from 'lodash';
import i18n from '../../../lib/i18n';
import SettingItem from './SettingItem';
import CheckboxItem from './CheckboxItem';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


function ConfigValueBox({ optionConfigGroup, calculateTextIndex, isCategorySelected, type = 'input', isDefinitionEditable = () => true, onChangeDefinition, definitionForManager, customConfigs }) {
    const [activeCateId, setActiveCateId] = useState(2);
    const scrollDom = useRef(null);
    function setActiveCate(cateId) {
        if (scrollDom.current) {
            const container = scrollDom.current.parentElement;
            const offsetTops = [...scrollDom.current.children].map(i => i.offsetTop);
            if (cateId !== undefined) {
                container.scrollTop = offsetTops[cateId] - 80;
            } else {
                cateId = offsetTops.findIndex((item, idx) => item < container.scrollTop && offsetTops[idx + 1] > container.scrollTop);
                cateId = Math.max(cateId, 0);
            }
            setActiveCateId(cateId);
        }
        return true;
    }
    // Make as a demo
    const isEditable = useCallback(() => {
        // console.log('isEditable');
        return isDefinitionEditable(definitionForManager);
    }, [isDefinitionEditable, definitionForManager]);

    return (
        <div style={{ display: 'flex' }}>
            {(optionConfigGroup.length > 2) && (
                <div className={classNames(styles['manager-grouplist'])}>
                    <div className="sm-parameter-container">
                        {optionConfigGroup.map((group, idx) => {
                            return (
                                <div
                                    key={i18n._(idx)}
                                >
                                    {group.name && (
                                        <Anchor
                                            className={classNames(styles.item, { [styles.selected]: idx === activeCateId })}

                                            onClick={() => {
                                                setActiveCate(idx);
                                            }}
                                        >
                                            <span className="sm-parameter-header__title">{i18n._(group.name)}</span>

                                        </Anchor>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div
                className={classNames(styles['manager-details'])}
                onWheel={() => { setActiveCate(); }}
            >
                <div className="sm-parameter-container" ref={scrollDom}>
                    {!isCategorySelected && optionConfigGroup.map((group) => {
                        return (
                            <div key={group.name || group.fields[0]}>
                                { group.name && (
                                    <Anchor
                                        className="sm-parameter-header"
                                    >
                                        <span className="fa fa-gear sm-parameter-header__indicator" />
                                        <span className="sm-parameter-header__title">{i18n._(group.name)}</span>
                                    </Anchor>
                                )}
                                { group.fields && group.fields.map((key) => {
                                    if (type === 'input') {
                                        return (
                                            <SettingItem
                                                settings={definitionForManager?.settings}
                                                definitionKey={key}
                                                width="160px"
                                                key={key}
                                                isDefinitionEditable={isEditable}
                                                onChangeDefinition={onChangeDefinition}
                                            />
                                        );
                                    } else if (type === 'checkbox') {
                                        return (
                                            <CheckboxItem
                                                calculateTextIndex={calculateTextIndex}
                                                settings={definitionForManager?.settings}
                                                defaultValue={includes(customConfigs, key)}
                                                definitionKey={key}
                                                key={key}
                                                isDefinitionEditable={isDefinitionEditable}
                                                onChangeDefinition={onChangeDefinition}
                                            />
                                        );
                                    } else {
                                        return null;
                                    }
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
ConfigValueBox.propTypes = {
    definitionForManager: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    isCategorySelected: PropTypes.bool,
    customConfigs: PropTypes.array,
    type: PropTypes.string,
    calculateTextIndex: PropTypes.func,
    isDefinitionEditable: PropTypes.func,
    onChangeDefinition: PropTypes.func.isRequired
};

export default React.memo(ConfigValueBox);
