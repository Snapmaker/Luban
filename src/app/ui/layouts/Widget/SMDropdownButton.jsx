import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Widget from '../../components/Widget';
import i18n from '../../../lib/i18n';


// Widget dropdown button (with fullscreen button)
const SMDropdownButton = React.memo(({ state, actions }) => {
    const { fullscreen } = state;
    const { onToggleFullscreen } = actions;

    return (
        <Widget.DropdownButton
            title={i18n._('fullscreen')}
            toggle={<i className="fa fa-ellipsis-v" />}
            onSelect={(eventKey) => {
                if (eventKey === 'fullscreen') {
                    onToggleFullscreen();
                }
            }}
        >
            <Widget.DropdownMenuItem eventKey="fullscreen">
                <i
                    className={classNames(
                        'fa',
                        'fa-fw',
                        { 'fa-expand': !fullscreen },
                        { 'fa-compress': fullscreen }
                    )}
                />
                <span className="space space-sm" />
                {!fullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
            </Widget.DropdownMenuItem>
        </Widget.DropdownButton>
    );
});
SMDropdownButton.propTypes = {
    state: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

export default SMDropdownButton;
