import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import PrintingObjectListBox from '../PrintingObjectList';
import Card from '../../components/Card';
import SvgIcon from '../../components/SvgIcon';
import { logModelViewOperation, logObjectListOperation } from '../../utils/gaEvent';
import { HEAD_PRINTING } from '../../../constants';

function VisualizerBottomLeft({ actions }) {
    return (
        <React.Fragment>
            <Card
                className={classNames('margin-horizontal-8')}
                title={i18n._('key-Printing/ObjectList-Object List')}
                onListToogleVisible={(visible) => {
                    logObjectListOperation(HEAD_PRINTING, visible ? 'expand' : 'pack');
                }}
            >
                <PrintingObjectListBox />
            </Card>
            <div className={classNames('margin-horizontal-8', 'height-30')}>
                <SvgIcon
                    name="ViewIsometric"
                    size={24}
                    onClick={actions.toTopFrontRight}
                />
                <SvgIcon
                    name="ViewFront"
                    size={24}
                    className="margin-left-2"
                    onClick={actions.toFront}
                />
                <SvgIcon
                    name="ViewTop"
                    size={24}
                    className="margin-left-2"
                    onClick={actions.toTop}
                />
                <SvgIcon
                    name="ViewLeft"
                    size={24}
                    className="margin-left-2"
                    onClick={actions.toLeft}
                />
                <SvgIcon
                    name="ViewRight"
                    size={24}
                    className="margin-left-2"
                    onClick={actions.toRight}
                />
                <div className="border-left-normal display-inline text-overflow-ellipsis height-20 margin-left-2 margin-top-4" />
                <SvgIcon
                    name="ScaleToFit"
                    size={24}
                    className="margin-left-2"
                    onClick={() => {
                        logModelViewOperation(HEAD_PRINTING, 'fit_view_in');
                        actions.fitViewIn();
                    }}
                />
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
