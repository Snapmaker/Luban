import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING
} from '../../../constants/machines';
import CNC from './CNC';
import Laser from './Laser';
import Printing from './Printing';


function MarlinWidget({ widgetActions }) {
    const { isConnected, headType } = useSelector(state => state.workspace, shallowEqual);

    const actions = {
        setTitle: (_headType) => {
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
        }
    };

    useEffect(() => {
        if (isConnected) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
        actions.setTitle(headType);
    }, []);

    useEffect(() => {
        widgetActions.setDisplay(isConnected);
    }, [isConnected]);

    useEffect(() => {
        actions.setTitle(headType);
    }, [headType]);

    return (
        <div>
            {(headType === HEAD_PRINTING) && <Printing />}
            {headType === HEAD_LASER && <Laser />}
            {headType === HEAD_CNC && <CNC />}
        </div>
    );
}
MarlinWidget.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default MarlinWidget;
