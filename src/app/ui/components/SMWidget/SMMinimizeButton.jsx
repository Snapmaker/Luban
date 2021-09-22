import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Widget from '../Widget';
import i18n from '../../../lib/i18n';

// Widget minimize button
const SMMinimizeButton = React.memo(({ state, actions }) => {
    const { fullscreen, minimized } = state;
    const { onToggleMinimized } = actions;

    return (
        <Widget.Button
            disabled={fullscreen}
            title={minimized ? i18n._('key_ui/components/SMWidget/SMMinimizeButton_Expand') : i18n._('key_ui/components/SMWidget/SMMinimizeButton_Collapse')}
            onClick={onToggleMinimized}
        >
            <i
                className={classNames(
                    'fa',
                    'fa-fw',
                    { 'fa-chevron-up': !minimized },
                    { 'fa-chevron-down': minimized }
                )}
            />
        </Widget.Button>
    );
});
SMMinimizeButton.propTypes = {
    state: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

export default SMMinimizeButton;
