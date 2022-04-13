import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import Slider from '../../components/Slider';
import Card from '../../components/Card';
import SvgIcon from '../../components/SvgIcon';
// import styles from './styles.styl';
import { MIN_LASER_CNC_CANVAS_SCALE, MAX_LASER_CNC_CANVAS_SCALE } from '../../../constants';
import CncLaserObjectList from '../CncLaserList/ObjectList';
import Anchor from '../../components/Anchor';

const VisualizerBottomLeft = ({ headType, toFront, zoomOut, zoomIn, scale, minScale, maxScale, updateScale }) => {
    return (
        <React.Fragment>
            <Anchor
                onClick={(event) => {
                    event.nativeEvent.stopImmediatePropagation();
                }}
            >
                <Card
                    className={classNames('margin-horizontal-8')}
                    title={i18n._('key-CncLaser/ObjectList_Title-Object List')}
                >
                    <CncLaserObjectList
                        headType={headType}
                    />
                </Card>
                <div className={classNames('margin-horizontal-8', 'height-24')}>
                    <SvgIcon
                        name="ViewFix"
                        onClick={toFront}
                    />
                    <SvgIcon
                        className="margin-horizontal-8"
                        name="ViewReduce"
                        onClick={zoomOut}
                    />
                    <Slider
                        value={scale}
                        min={minScale ?? MIN_LASER_CNC_CANVAS_SCALE}
                        max={maxScale ?? MAX_LASER_CNC_CANVAS_SCALE}
                        step={0.1}
                        isBlack
                        onChange={(value) => {
                            updateScale(value);
                        }}
                        onAfterChange={() => {
                        }}
                    />
                    <SvgIcon
                        name="ViewEnlarge"
                        className="margin-left-8"
                        onClick={zoomIn}
                    />
                </div>
            </Anchor>
        </React.Fragment>
    );
};

VisualizerBottomLeft.propTypes = {
    zoomIn: PropTypes.func.isRequired,
    zoomOut: PropTypes.func.isRequired,
    toFront: PropTypes.func.isRequired,
    scale: PropTypes.number.isRequired,
    minScale: PropTypes.number,
    maxScale: PropTypes.number,
    updateScale: PropTypes.func.isRequired,
    headType: PropTypes.string.isRequired
};

export default VisualizerBottomLeft;
