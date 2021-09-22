import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import log from '../../../lib/log';
import Enclosure from './Enclosure';
import i18n from '../../../lib/i18n';

// import { actions as machineActions } from '../../flux/machine';
import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../../constants';

function EnclosureDisplay({ widgetActions }) {
    const { server, isConnected, connectionType, enclosureOnline } = useSelector(state => state.machine);

    useEffect(() => {
        widgetActions.setTitle(i18n._('key_ui/widgets/Enclosure/EnclosureDisplay_Enclosure'));
        widgetActions.setDisplay(false);
        if (!isConnected) {
            widgetActions.setDisplay(false);
            return;
        }
        if (isConnected && enclosureOnline
            && connectionType === CONNECTION_TYPE_SERIAL) {
            widgetActions.setDisplay(true);
        }

        if (isConnected && connectionType === CONNECTION_TYPE_WIFI) {
            server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    const { isReady } = res;
                    if (isReady === true) {
                        widgetActions.setDisplay(true);
                    }
                }
            });
        }
    }, []);

    useEffect(() => {
        if (!isConnected) {
            widgetActions.setDisplay(false);
        }
    }, [isConnected]);

    useEffect(() => {
        if (isConnected && enclosureOnline && connectionType === CONNECTION_TYPE_SERIAL) {
            widgetActions.setDisplay(true);
        }
    }, [enclosureOnline, isConnected, connectionType]);

    useEffect(() => {
        if (isConnected && connectionType === CONNECTION_TYPE_WIFI) {
            server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    const { isReady } = res;
                    if (isReady === true) {
                        widgetActions.setDisplay(true);
                    }
                }
            });
        }
    }, [isConnected, connectionType]);

    return (
        <Enclosure />
    );
}
EnclosureDisplay.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default EnclosureDisplay;
