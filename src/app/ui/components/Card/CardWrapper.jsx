// import { Checkbox } from 'antd';
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Card } from 'antd';
import noop from 'lodash/noop';
import styles from './styles.styl';
import SvgIcon from '../SvgIcon';
// import i18n from '../../../lib/i18n';

const CardWrapper = React.memo(({ className = '', children, hasToggleBotton = true, onListToogleVisible = noop, ...rest }) => {
    const [showList, setShowList] = useState(true);
    let extra;
    if (hasToggleBotton) {
        extra = (
            <SvgIcon
                name="DropdownLine"
                onClick={() => {
                    const visible = !showList;
                    setShowList(visible);
                    onListToogleVisible(visible);
                }}
                className={classNames(
                    showList ? '' : 'rotate180'
                )}
            />
        );
    }
    return (

        <div className={classNames(styles.card, className)}>
            <Card
                {...rest}
                extra={extra}
            >
                {
                    showList && (
                        <div>
                            { children }
                        </div>
                    )
                }
            </Card>
        </div>

    );
});
CardWrapper.propTypes = {
    className: PropTypes.string,
    hasToggleBotton: PropTypes.bool,
    children: PropTypes.object,
    onListToogleVisible: PropTypes.func
};

export default CardWrapper;
