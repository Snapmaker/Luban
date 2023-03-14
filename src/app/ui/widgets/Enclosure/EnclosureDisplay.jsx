import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import Enclosure from './Enclosure';

function EnclosureDisplay({ widgetActions }) {
    const {
        isConnected,
        enclosureOnline,
    } = useSelector(state => state.workspace);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Enclosure-Enclosure'));
    }, []);

    useEffect(() => {
        if (isConnected && enclosureOnline) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [widgetActions, isConnected, enclosureOnline]);

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
