import React, { useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING
} from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import CNC from './CNC';
import Laser from './Laser';
import Printing from './Printing';


declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

export declare interface ToolControlViewProps {
    widgetActions: WidgetActions;
}

const ToolControlView: React.FC<ToolControlViewProps> = (props) => {
    const { widgetActions } = props;

    const { isConnected, headType } = useSelector((state: RootState) => state.workspace);

    const setTitle = useCallback((_headType) => {
        let title = 'Detecting...';
        if (_headType === HEAD_PRINTING) {
            title = '3D Printer';
        }
        if (_headType === HEAD_LASER) {
            title = 'key-unused-Laser';
        }
        if (_headType === HEAD_CNC) {
            title = 'CNC';
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
                headType === HEAD_PRINTING && <Printing />
            }
            {
                headType === HEAD_LASER && <Laser />
            }
            {
                headType === HEAD_CNC && <CNC />
            }
        </div>
    );
};

export default ToolControlView;
