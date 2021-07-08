import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import Slider from '../../components/Slider';
import Card from '../../components/Card';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';
import { MIN_LASER_CNC_CANVAS_SCALE, MAX_LASER_CNC_CANVAS_SCALE } from '../../../constants';
import CncLaserObjectList from '../CncLaserList/ObjectList';


class VisualizerBottomLeft extends PureComponent {
    static propTypes = {
        zoomIn: PropTypes.func.isRequired,
        zoomOut: PropTypes.func.isRequired,
        toFront: PropTypes.func.isRequired,
        scale: PropTypes.number.isRequired,
        minScale: PropTypes.number,
        maxScale: PropTypes.number,
        updateScale: PropTypes.func.isRequired,
        headType: PropTypes.string.isRequired
    };

    // ViewEnlarge
    render() {
        return (
            <React.Fragment>
                <Card
                    className={classNames(styles['object-list'], 'margin-horizontal-8')}
                    title="Object List"
                >
                    <CncLaserObjectList
                        headType={this.props.headType}
                    />
                </Card>
                <div className={classNames(styles['camera-operation'], 'margin-horizontal-8')}>
                    <SvgIcon
                        name="ViewFix"
                        onClick={this.props.toFront}
                    />
                    <SvgIcon
                        name="ViewReduce"
                        onClick={this.props.zoomOut}
                    />
                    <span className={styles['scale-slider']}>
                        <Slider
                            value={this.props.scale}
                            min={this.props.minScale ?? MIN_LASER_CNC_CANVAS_SCALE}
                            max={this.props.maxScale ?? MAX_LASER_CNC_CANVAS_SCALE}
                            step={0.1}
                            className="margin-0"
                            onChange={(value) => {
                                this.props.updateScale(value);
                            }}
                            onAfterChange={() => {
                            }}
                        />
                    </span>
                    <SvgIcon
                        name="ViewEnlarge"
                        onClick={this.props.zoomIn}
                    />
                </div>
            </React.Fragment>
        );
    }
}

export default VisualizerBottomLeft;
