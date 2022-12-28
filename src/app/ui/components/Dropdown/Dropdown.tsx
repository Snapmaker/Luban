import React from 'react';
import classNames from 'classnames';
import { Dropdown as AntDropdown } from 'antd';
import { DropdownProps } from 'antd/lib/dropdown';

import '../../../styles/global.styl';
import './styles.styl';

const Dropdown: React.FC<DropdownProps> = (props) => {
    const { className, placement = 'bottom', overlay = <div />, ...rest } = props;

    return (
        <div className={className}>
            <AntDropdown
                overlayClassName={classNames('border-radius-8', 'border-default-black-5')}
                {...rest}
                overlay={overlay}
                placement={placement}
            >
                {props.children}
            </AntDropdown>
        </div>
    );
};

export default Dropdown;
