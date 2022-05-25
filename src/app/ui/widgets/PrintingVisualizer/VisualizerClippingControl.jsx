import React, { useState, useEffect, useRef } from 'react';
// import PropTypes from 'prop-types';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { throttle } from 'lodash';
import Slider from '../../components/Slider';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';

function ClippingControlLayout() {
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const dispatch = useDispatch();

    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue(primeTowerHeight);
    }, [primeTowerHeight]);

    const update = useRef(throttle((v) => {
        return dispatch(printingActions.updateClippingPlane(v));
    }));

    const onChange = (v) => {
        setValue(v);
        update.current(v);
    };

    return (
        <div className={styles['layer-wrapper']}>
            <span className={styles['layer-label']}>{value}</span>
            <div
                style={{
                    position: 'relative',
                    marginLeft: '2px'
                }}
            >
                <Slider
                    tooltipVisible={false}
                    className={styles['vertical-slider']}
                    vertical
                    min={0}
                    max={primeTowerHeight}
                    step={0.24}
                    value={value}
                    onChange={(v) => {
                        onChange(v);
                    }}
                />
            </div>
        </div>
    );
}

function VisualizerClippingControl() {
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const modelGroup = useSelector(state => state?.printing?.modelGroup, shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);

    const clipping = modelGroup.models.some((model) => {
        return model.clippingWorkerMap.size !== 0;
    });

    if (!clipping && displayedType === 'model' && !transformMode && modelGroup.models.length && !(modelGroup.models.length === 1 && modelGroup.models[0].type === 'primeTower')) {
        return (
            <React.Fragment>
                <ClippingControlLayout />
            </React.Fragment>
        );
    } else {
        return null;
    }
}


export default VisualizerClippingControl;
