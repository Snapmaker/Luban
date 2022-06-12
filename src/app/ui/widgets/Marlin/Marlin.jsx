import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import Laser from './Laser';
import Printing from './Printing';
import CNC from './CNC';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING
} from '../../../constants';


function MarlinWidget({ widgetActions }) {
    const { isConnected } = useSelector(state => state.machine);
    const { headType } = useSelector(state => state?.workspace);
    // const headType = HEAD_PRINTING;

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
        // widgetActions.setDisplay(true);
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
        <div className="font-roboto">
            {(headType === HEAD_PRINTING) && <Printing />}
            {headType === HEAD_LASER && <Laser />}
            {headType === HEAD_CNC && <CNC />}
            {/* <Printing /> */}
            {/* <Laser /> */}
            {/* <CNC /> */}
        </div>
    );
}
MarlinWidget.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default MarlinWidget;
