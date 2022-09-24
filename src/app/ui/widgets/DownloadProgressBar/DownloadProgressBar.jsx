import PropTypes from 'prop-types';
import React from 'react';
// import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
// import classNames from 'classnames';
import noop from 'lodash';
import ProgressBar from '../../components/ProgressBar';
import SvgIcon from '../../components/SvgIcon';
import Anchor from '../../components/Anchor';
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
            <div>
                <Anchor onClick={onMinimize}>
                    <SvgIcon
                        className="margin-right-8"
                        type={['static']}
                        name="Decrease"
                    />
                </Anchor>
                <Anchor onClick={onClose}>
                    <SvgIcon
                        type={['static']}
                        name="Cancel"
                    />
                </Anchor>
            </div>
        );
    }
    return (
        <div>
            <ProgressBar
                closeIcon={renderProfileMenu()}
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
