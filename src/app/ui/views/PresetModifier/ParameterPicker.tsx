import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { throttle } from 'lodash';

import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import ParameterCheckItem from './ParameterCheckItem';
import styles from './styles.styl';


/**
 * Render a parameter list (tree shape based on settings information).
 *
 * @param allKeys
 * @param selectedKeys
 * @param onChange
 * @param settings
 * @param parameterKeys
 */
const renderParameterCheckItemList = (
    {
        allKeys,
        selectedKeys,
        onChange,
        settings, // settings is used for check children of a key
        parameterKeys, // check key is allowed
    }
) => {
    return allKeys && allKeys.map(key => {
        const setting = settings[key];
        const { label, childKey } = setting;
        const isChecked = selectedKeys.includes(key);

        const allowed = parameterKeys.includes(key);

        if (allowed) {
            return (
                <div key={key} className="margin-left-24 margin-vertical-4">
                    <ParameterCheckItem
                        label={i18n._(label)}
                        checked={isChecked}
                        onChange={(checked) => onChange(key, checked)}
                    />
                    {
                        childKey && renderParameterCheckItemList({
                            allKeys: childKey,
                            selectedKeys,
                            onChange,
                            settings,
                            parameterKeys,
                        })
                    }
                </div>
            );
        } else {
            return null;
        }
    });
};


interface CustomKeys {
    [key: string]: string[];
}

type Props = {
    optionConfigGroup: any;
    customConfigs: CustomKeys;
    parameterKeys: string[];
    settings: any;
    onChangeCustomConfig: any;
};


/**
 * Parameter Picker.
 *
 * Pick parameters to be shown.
 *
 * This component will take 100% width and height of its parent.
 */
const ParameterPicker: React.FC<Props> = (props) => {
    const {
        optionConfigGroup,
        customConfigs,
        parameterKeys = [],
        settings,
        onChangeCustomConfig,
    } = props;

    const [activeCateId, setActiveCateId] = useState(2);

    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);

    function setActiveCate(cateId?: number) {
        if (scrollDom.current) {
            const container = scrollDom.current.parentElement;
            const offsetTops = [...scrollDom.current.children].map(
                (i) => i.offsetTop
            );
            if (cateId !== undefined) {
                container.scrollTop = offsetTops[cateId];
            } else {
                cateId = offsetTops.findIndex((item, idx) => {
                    if (idx < offsetTops.length - 1) {
                        return item < container.scrollTop
                            && offsetTops[idx + 1] > container.scrollTop;
                    } else {
                        return item < container.scrollTop;
                    }
                });
                cateId = Math.max(cateId, 0);
            }
            setActiveCateId(cateId);
        }
    }

    return (
        <div className="sm-flex width-percent-100 height-percent-100">
            <div
                className={classNames(
                    styles['manager-grouplist'],
                    'padding-vertical-4',
                    'padding-horizontal-8',
                )}
            >
                {
                    Object.keys(optionConfigGroup).map((category, index) => {
                        return (
                            <div key={category} className="margin-vertical-4">
                                <Anchor
                                    className={classNames(styles.item, {
                                        [styles.selected]:
                                        index === activeCateId
                                    })}
                                    onClick={() => {
                                        setActiveCate(index);
                                    }}
                                >
                                    <span className="sm-parameter-header__title">{i18n._(`key-Definition/Category-${category}`)}</span>
                                </Anchor>
                            </div>
                        );
                    })
                }
            </div>
            <div
                className={classNames(
                    styles['manager-detail-and-docs'],
                    'sm-flex',
                    'justify-space-between',
                )}
            >
                <div
                    className={classNames(
                        styles['manager-details'],
                        'border-radius-8',
                        'width-percent-60 '
                    )}
                    onWheel={throttle(
                        () => {
                            setActiveCate();
                        },
                        200,
                        { leading: false, trailing: true }
                    )}
                >
                    <div className="sm-parameter-container" ref={scrollDom}>
                        {
                            Object.keys(optionConfigGroup).map((category, index) => {
                                function onChange(key, checked) {
                                    onChangeCustomConfig(key, checked, category);
                                }

                                const selectedKeys = customConfigs[category] || [];

                                return (
                                    <div key={category}>
                                        {
                                            fieldsDom.current[index]?.clientHeight > 0 && (
                                                <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                    <SvgIcon
                                                        name="TitleSetting"
                                                        type={['static']}
                                                    />
                                                    <span className="margin-left-2">
                                                        {i18n._(`key-Definition/Category-${category}`)}
                                                    </span>
                                                </div>
                                            )
                                        }
                                        <div>
                                            <div
                                                ref={(el) => {
                                                    fieldsDom.current[index] = el;
                                                }}
                                            >
                                                {
                                                    renderParameterCheckItemList({
                                                        allKeys: optionConfigGroup[category],
                                                        selectedKeys,
                                                        onChange,
                                                        settings,
                                                        parameterKeys,
                                                    })
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParameterPicker;
