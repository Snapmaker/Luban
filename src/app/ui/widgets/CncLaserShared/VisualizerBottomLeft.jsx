import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { MIN_LASER_CNC_CANVAS_SCALE, MAX_LASER_CNC_CANVAS_SCALE } from '../../../constants';


class VisualizerBottomLeft extends PureComponent {
    static propTypes = {
        zoomIn: PropTypes.func.isRequired,
        zoomOut: PropTypes.func.isRequired,
        toFront: PropTypes.func.isRequired,
        scale: PropTypes.number.isRequired,
        minScale: PropTypes.number,
        maxScale: PropTypes.number,
        updateScale: PropTypes.func.isRequired
    };

    render() {
        return (
            <div className={classNames(styles['camera-operation'])}>
                <Anchor
                    className={classNames(styles['zoom-button'], styles['to-front'])}
                    onClick={this.props.toFront}
                />
                <Anchor
                    className={classNames(styles['zoom-button'], styles['zoom-out'])}
                    onClick={this.props.zoomOut}
                />
                <span className={styles['scale-slider']}>
                    <Slider
                        value={this.props.scale}
                        min={this.props.minScale ?? MIN_LASER_CNC_CANVAS_SCALE}
                        max={this.props.maxScale ?? MAX_LASER_CNC_CANVAS_SCALE}
                        step={0.1}
                        onChange={(value) => {
                            this.props.updateScale(value);
                        }}
                        onAfterChange={() => {
                        }}
                    />
                </span>
                <Anchor
                    className={classNames(styles['zoom-button'], styles['zoom-in'])}
                    onClick={this.props.zoomIn}
                />
            </div>
        );
    }
}

export default VisualizerBottomLeft;
