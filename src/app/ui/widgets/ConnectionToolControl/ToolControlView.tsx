import React, { useCallback, useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';

import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING
} from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import i18n from '../../../lib/i18n';
import CNC from './CNC';
import LaserToolControl from './LaserToolControl';
import PrintToolControl from './PrintToolControl';


declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

export declare interface ToolControlViewProps {
    widgetActions: WidgetActions;
}

const ToolControlView: React.FC<ToolControlViewProps> = (props) => {
    const { widgetActions } = props;

    const { isConnected, headType } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const setTitle = useCallback((_headType) => {
        let title = 'Detecting...';
        if (_headType === HEAD_PRINTING) {
            title = i18n._('3D Printer');
        }
        if (_headType === HEAD_LASER) {
            title = i18n._('key-unused-Laser');
        }
        if (_headType === HEAD_CNC) {
            title = i18n._('CNC');
        }
        widgetActions.setTitle(title);
    }, [widgetActions]);

    useEffect(() => {
        if (isConnected) {
            widgetActions.setDisplay(true);
            setTitle(headType);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, widgetActions, headType, setTitle]);

    useEffect(() => {
        widgetActions.setDisplay(isConnected);
    }, [widgetActions, isConnected]);

    return (
        <div>
            {
                headType === HEAD_PRINTING && <PrintToolControl />
            }
            {
                headType === HEAD_LASER && <LaserToolControl />
            }
            {
                headType === HEAD_CNC && <CNC />
            }
        </div>
    );
};

export default ToolControlView;
