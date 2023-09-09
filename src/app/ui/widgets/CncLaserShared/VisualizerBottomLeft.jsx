import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import i18n from '../../../lib/i18n';
import Card from '../../components/Card';
import Slider from '../../components/Slider';
import SvgIcon from '../../components/SvgIcon';
// import styles from './styles.styl';
import { DISPLAYED_TYPE_TOOLPATH, MAX_LASER_CNC_CANVAS_SCALE, MIN_LASER_CNC_CANVAS_SCALE } from '../../../constants';
import CncLaserObjectList from '../CncLaserList/ObjectList';

const VisualizerBottomLeft = ({ headType, toFront, zoomOut, zoomIn, scale, minScale, maxScale, updateScale, displayedType }) => {
    return (
        <div
            style={{
                textDecoration: 'none',
                cursor: 'auto',
            }}
        >
            <div className="margin-horizontal-8">
                <div className="margin-bottom-8">
                    <Card
                        title={i18n._('key-CncLaser/ObjectList_Title-Object List')}
                        hasToggleButton
                    >
                        <CncLaserObjectList
                            headType={headType}
                        />
                    </Card>
                </div>
            </div>
            {displayedType !== DISPLAYED_TYPE_TOOLPATH && (
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
            )}
        </div>
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
    headType: PropTypes.string.isRequired,
    displayedType: PropTypes.string
};

export default VisualizerBottomLeft;
