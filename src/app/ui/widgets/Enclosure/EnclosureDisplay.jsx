import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import Enclosure from './Enclosure';
import i18n from '../../../lib/i18n';

function EnclosureDisplay({ widgetActions }) {
    const { isConnected, enclosureOnline } = useSelector(state => state.machine);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Enclosure-Enclosure'));
        widgetActions.setDisplay(false);
        if (isConnected && enclosureOnline) {
            widgetActions.setDisplay(true);
        }
    }, []);

    useEffect(() => {
        if (!isConnected) {
            widgetActions.setDisplay(false);
        } else if (isConnected && enclosureOnline) {
            widgetActions.setDisplay(true);
        }
    }, [isConnected, widgetActions, enclosureOnline]);


    return (
        <Enclosure />
    );
}
EnclosureDisplay.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default EnclosureDisplay;
