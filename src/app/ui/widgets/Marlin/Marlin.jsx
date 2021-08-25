import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import Printing from './Printing';
import Laser from './Laser';
import CNC from './CNC';
import {
    MACHINE_HEAD_TYPE
} from '../../../constants';


function MarlinWidget({ widgetActions }) {
    const { headType, isConnected } = useSelector(state => state.machine);

    const actions = {
        setTitle: (_headType) => {
            let title = 'Detecting...';
            if (_headType === MACHINE_HEAD_TYPE['3DP'].value) {
                title = '3D Printer';
            }
            if (_headType === MACHINE_HEAD_TYPE.LASER.value) {
                title = 'Laser';
            }
            if (_headType === MACHINE_HEAD_TYPE.CNC.value) {
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
            {headType === MACHINE_HEAD_TYPE['3DP'].value && <Printing />}
            {headType === MACHINE_HEAD_TYPE.LASER.value && <Laser />}
            {headType === MACHINE_HEAD_TYPE.CNC.value && <CNC />}
        </div>
    );
}
MarlinWidget.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default MarlinWidget;
