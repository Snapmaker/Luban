import { Card } from 'antd';
import classNames from 'classnames';
import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import SvgIcon from '../SvgIcon';
import styles from './styles.styl';
// import i18n from '../../../lib/i18n';

const CardWrapper = React.memo(({ className = '', children, hasToggleButton = true, onShowContent = noop, ...rest }) => {
    const [showContent, setShowContent] = useState(true);

    // toggle button on the top left corner
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
        <div className={classNames(styles.card, className)}>
            <Card
                {...rest}
                extra={extra}
            >
                {
                    showContent && (
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
    hasToggleButton: PropTypes.bool,
    children: PropTypes.object,
    onShowContent: PropTypes.func
};

export default CardWrapper;
