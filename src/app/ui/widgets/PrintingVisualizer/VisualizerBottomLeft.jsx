import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import i18n from '../../../lib/i18n';
import PrintingObjectListBox from '../PrintingObjectList';
import Card from '../../components/Card';
import SvgIcon from '../../components/SvgIcon';

function VisualizerBottomLeft({ actions }) {
    return (
        <React.Fragment>
            <Card
                className={classNames('margin-horizontal-8')}
                title={i18n._('key-Printing/ObjectList-Object List')}
            >
                <PrintingObjectListBox />
            </Card>
            <div className={classNames('margin-horizontal-8', 'height-30')}>
                <Tooltip title={i18n._('key-Printing/View-Isometric')} arrowPointAtCenter>
                    <SvgIcon
                        name="ViewIsometric"
                        size={24}
                        onClick={actions.toTopFrontRight}
                    />
                </Tooltip>
                <Tooltip title={i18n._('key-Printing/View-Front')} arrowPointAtCenter>
                    <SvgIcon
                        name="ViewFront"
                        size={24}
                        className="margin-left-2"
                        onClick={actions.toFront}
                    />
                </Tooltip>
                <Tooltip title={i18n._('key-Printing/View-Top')} arrowPointAtCenter>
                    <SvgIcon
                        name="ViewTop"
                        size={24}
                        className="margin-left-2"
                        onClick={actions.toTop}
                    />
                </Tooltip>
                <Tooltip title={i18n._('key-Printing/View-Left')} arrowPointAtCenter>
                    <SvgIcon
                        name="ViewLeft"
                        size={24}
                        className="margin-left-2"
                        onClick={actions.toLeft}
                    />
                </Tooltip>
                <Tooltip title={i18n._('key-Printing/View-Right')} arrowPointAtCenter>
                    <SvgIcon
                        name="ViewRight"
                        size={24}
                        className="margin-left-2"
                        onClick={actions.toRight}
                    />
                </Tooltip>
                <div className="display-inline width-1 height-22 background-grey-1 margin-horizontal-4 margin-vertical-4" />
                <Tooltip title={i18n._('key-Printing/View-Auto Zoom')} arrowPointAtCenter>
                    <SvgIcon
                        name="ScaleToFit"
                        size={24}
                        onClick={actions.fitViewIn}
                    />
                </Tooltip>
            </div>
        </React.Fragment>
    );
}
VisualizerBottomLeft.propTypes = {
    actions: PropTypes.shape({
        toLeft: PropTypes.func.isRequired,
        toTop: PropTypes.func.isRequired,
        toTopFrontRight: PropTypes.func.isRequired,
        toRight: PropTypes.func.isRequired,
        toFront: PropTypes.func.isRequired,
        fitViewIn: PropTypes.func.isRequired
    })
};
export default React.memo(VisualizerBottomLeft);
