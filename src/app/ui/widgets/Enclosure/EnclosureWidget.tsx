import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import Enclosure from './Enclosure';

interface EnclosureWidgetProps {
    widgetActions: {
        setTitle: (n: string) => void;
        setDisplay: (display: boolean) => void;
    }
}

const EnclosureDisplay: React.FC<EnclosureWidgetProps> = ({ widgetActions }) => {
    const {
        isConnected,
        enclosureOnline,
    } = useSelector((state: RootState) => state.workspace);

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
};

export default EnclosureDisplay;
