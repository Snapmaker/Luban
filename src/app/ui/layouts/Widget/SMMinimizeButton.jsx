import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';

// Widget minimize button
const SMMinimizeButton = React.memo(({ state, actions, className }) => {
    const { fullscreen, minimized } = state;
    const { onToggleMinimized } = actions;

    return (
        <SvgIcon
            disabled={fullscreen}
            title={minimized ? i18n._('key_ui/layouts/Widget/SMMinimizeButton_Expand') : i18n._('key_ui/layouts/Widget/SMMinimizeButton_Collapse')}
            onClick={onToggleMinimized}
            name="DropdownLine"
            size={24}
            type={['static']}
            className={classNames(
                className,
                !minimized ? '' : 'rotate180'
            )}
        />
    );
});
SMMinimizeButton.propTypes = {
    state: PropTypes.object.isRequired,
    className: PropTypes.string,
    actions: PropTypes.object.isRequired
};

export default SMMinimizeButton;
