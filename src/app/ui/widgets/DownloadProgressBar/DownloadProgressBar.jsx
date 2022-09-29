import PropTypes from 'prop-types';
import React from 'react';
// import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
// import classNames from 'classnames';
import noop from 'lodash';
import ProgressBar from '../../components/ProgressBar';
import SvgIcon from '../../components/SvgIcon';
// import Anchor from '../../components/Anchor';
// import {
//     SPEED_HIGH,
//     SPEED_MEDIUM,
//     SPEED_LOW,
//     CONNECTION_FILTER_SWITCH,
//     CONNECTION_FILTER_WORKSPEED,
//     MACHINE_SERIES
// } from '../../../constants';
// import i18n from '../../../lib/i18n';

function DownloadProgressBar({ tips, subTips, onClose = noop, onMinimize = noop }) {
    const progress = useSelector(state => state.appGlobal.progress);

    function renderProfileMenu() {
        return (
            <div
                className="margin-right-12 margin-top-8"
            >
                <div className="margin-right-12 display-inline">
                    <SvgIcon
                        onClick={onMinimize}
                        type={['static']}
                        size={24}
                        name="Decrease"
                    />
                </div>
                <div className="display-inline">
                    <SvgIcon
                        onClick={onClose}
                        type={['static']}
                        size={24}
                        name="Cancel"
                    />
                </div>
            </div>
        );
    }
    return (
        <div>
            <ProgressBar
                closeIcon={renderProfileMenu()}
                bottomDistance={158}
                closable
                tips={`${tips + progress * 100}%`}
                subTips={subTips}
                progress={progress * 100}
            />
        </div>
    );
}
DownloadProgressBar.propTypes = {
    tips: PropTypes.string,
    onClose: PropTypes.func,
    onMinimize: PropTypes.func,
    subTips: PropTypes.string
};

export default DownloadProgressBar;
