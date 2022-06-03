import React, { useState, useEffect, useRef } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { find as lodashFind, throttle } from 'lodash';
import Slider from '../../components/Slider';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';

function ClippingControlLayout() {
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions, shallowEqual);
    const defaultQualityId = useSelector(state => state?.printing?.defaultQualityId, shallowEqual);

    const activeQualityDefinition = lodashFind(qualityDefinitions, {
        definitionId: defaultQualityId
    });
    const qualitySetting = activeQualityDefinition.settings;

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
                    step={qualitySetting.layer_height.default_value}
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
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const clipped = useSelector(state => state?.printing?.modelGroup.hasClipped(), shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);

    const [_clipped, setClipped] = useState(clipped);
    useEffect(() => {
        setClipped(clipped);
    }, [clipped]);

    useEffect(() => {
        modelGroup.on('test12', () => {
            setClipped(true);
        });
    }, [modelGroup]);


    if (_clipped && displayedType === 'model' && !transformMode && modelGroup.models.length && !(modelGroup.models.length === 1 && modelGroup.models[0].type === 'primeTower')) {
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
