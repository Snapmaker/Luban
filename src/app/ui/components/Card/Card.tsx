import { Card as AntdCard, CardProps as AntdCardProps } from 'antd';
import classNames from 'classnames';
import noop from 'lodash/noop';
import React, { useState } from 'react';

import SvgIcon from '../SvgIcon';
import styles from './styles.styl';


declare interface CardProps extends AntdCardProps {
    hasToggleButton?: boolean;
    onShowContent: (show: boolean) => void;
}

const Card: React.FC<CardProps> = (props) => {
    const { className = '', children, hasToggleButton = false, onShowContent = noop, ...rest } = props;
    const [showContent, setShowContent] = useState(true);

    // toggle button as extra
    let extra = null;
    if (hasToggleButton) {
        extra = (
            <SvgIcon
                name="DropdownLine"
                onClick={() => {
                    const visible = !showContent;
                    setShowContent(visible);
                    onShowContent(visible);
                }}
                className={classNames(
                    showContent ? '' : 'rotate180'
                )}
            />
        );
    }

    return (
        <div className={classNames(styles['custom-card'], className)}>
            <AntdCard
                {...rest}
                size="small"
                extra={extra}
            >
                {
                    showContent && children
                }
            </AntdCard>
        </div>

    );
};


export default Card;
