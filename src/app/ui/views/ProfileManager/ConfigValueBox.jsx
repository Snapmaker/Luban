import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import SettingItem from './SettingItem';
import CheckboxItem from './CheckboxItem';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


function ConfigValueBox({ optionConfigGroup, type = 'input', isDefinitionEditable = () => true, onChangeDefinition, definitionState }) {
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
                    {!definitionState?.isCategorySelected && optionConfigGroup.map((group) => {
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
                                                settings={definitionState?.definitionForManager?.settings}
                                                definitionKey={key}
                                                width="160px"
                                                key={key}
                                                isDefinitionEditable={() => isDefinitionEditable(definitionState?.definitionForManager)}
                                                onChangeDefinition={onChangeDefinition}
                                            />
                                        );
                                    } else if (type === 'checkbox') {
                                        return (
                                            <CheckboxItem
                                                settings={definitionState?.settings}
                                                definitionKey={key}
                                                key={key}
                                                isDefinitionEditable={() => isDefinitionEditable(definitionState)}
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
    definitionState: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    type: PropTypes.string,
    isDefinitionEditable: PropTypes.func,
    onChangeDefinition: PropTypes.func.isRequired
};

export default ConfigValueBox;
