import React, { Component } from 'react';
// import classNames from 'classnames';
import PropTypes from 'prop-types';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
// import styles from './secondary-toolbar.styl';


class SecondaryToolbar extends Component {
    static propTypes = {
        zoomIn: PropTypes.func,
        zoomOut: PropTypes.func,
        toFront: PropTypes.func
    };

    render() {
        const { zoomIn, zoomOut, toFront } = this.props;
        return (
            <div>
                <SvgIcon
                    name="ViewFix"
                    title={i18n._('Reset Position')}
                    onClick={toFront}
                />
                <SvgIcon
                    className="margin-horizontal-8"
                    name="ViewReduce"
                    title={i18n._('Zoom Out')}
                    onClick={zoomOut}
                />
                <SvgIcon
                    name="ViewEnlarge"
                    onClick={zoomIn}
                    title={i18n._('Zoom In')}
                />
            </div>
        );
    }
}

export default SecondaryToolbar;
