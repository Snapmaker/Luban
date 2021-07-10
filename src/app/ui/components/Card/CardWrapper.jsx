// import { Checkbox } from 'antd';
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Card } from 'antd';
import SvgIcon from '../SvgIcon';
import styles from './styles.styl';
// import i18n from '../../../lib/i18n';

function CardWrapper({ className = '', children, hasToggleBotton = true, ...rest }) {
    const [showList, setShowList] = useState(true);
    let extra;
    if (hasToggleBotton) {
        extra = (
            <SvgIcon
                name="DropdownLine"
                onClick={() => setShowList(!showList)}
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
                {showList
                    && (
                        <div>
                            { children }
                        </div>
                    )
                }
            </Card>
        </div>

    );
}
CardWrapper.propTypes = {
    className: PropTypes.string,
    hasToggleBotton: PropTypes.bool,
    children: PropTypes.object
};

export default CardWrapper;
