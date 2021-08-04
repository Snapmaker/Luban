import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { HEAD_3DP } from '../../../constants';
import PrintingObjectListBox from '../PrintingObjectList';
import Card from '../../components/Card';
import SvgIcon from '../../components/SvgIcon';

class VisualizerBottomLeft extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            toLeft: PropTypes.func.isRequired,
            toTop: PropTypes.func.isRequired,
            toTopFrontRight: PropTypes.func.isRequired,
            toRight: PropTypes.func.isRequired,
            toFront: PropTypes.func.isRequired
        })
    };

    render() {
        const actions = this.props.actions;
        return (
            <React.Fragment>
                <Card
                    className={classNames('margin-horizontal-8')}
                    title="Object List"
                >
                    <PrintingObjectListBox
                        headType={HEAD_3DP}
                    />
                </Card>
                <div className={classNames('margin-horizontal-8', 'height-30')}>
                    <SvgIcon
                        name="ViewIsometric"
                        size={30}
                        onClick={actions.toTopFrontRight}
                    />
                    <SvgIcon
                        name="ViewFront"
                        size={30}
                        className="margin-left-2"
                        onClick={actions.toFront}
                    />
                    <SvgIcon
                        name="ViewTop"
                        size={30}
                        className="margin-left-2"
                        onClick={actions.toTop}
                    />
                    <SvgIcon
                        name="ViewLeft"
                        size={30}
                        className="margin-left-2"
                        onClick={actions.toLeft}
                    />
                    <SvgIcon
                        name="ViewRight"
                        size={30}
                        className="margin-left-2"
                        onClick={actions.toRight}
                    />
                </div>
            </React.Fragment>
        );
    }
}

export default VisualizerBottomLeft;
