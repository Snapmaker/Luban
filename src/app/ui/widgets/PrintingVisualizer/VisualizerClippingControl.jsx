import React, { useState, useEffect, useRef } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { find as lodashFind, noop, throttle } from 'lodash';
import Slider from '../../components/Slider';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import { ModelEvents } from '../../../models/events';

function VisualizerClippingControl() {
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions, shallowEqual);
    const defaultQualityId = useSelector(state => state?.printing?.defaultQualityId, shallowEqual);

    const dispatch = useDispatch();

    const activeQualityDefinition = lodashFind(qualityDefinitions, {
        definitionId: defaultQualityId
    });
    const qualitySetting = activeQualityDefinition?.settings;


    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue(primeTowerHeight);
    }, [primeTowerHeight]);
    useEffect(() => {
        modelGroup.on(ModelEvents.ClippingReset, () => {
            setValue(primeTowerHeight + qualitySetting?.layer_height?.default_value);
        });
        return () => {
            modelGroup.off(ModelEvents.ClippingReset, noop);
        };
    }, []);

    const update = useRef(throttle((v) => {
        return dispatch(printingActions.updateClippingPlane(v));
    }, 300));

    const onChange = (v) => {
        setValue(v);
        update.current(v);
    };

    const isSpecialMode = transformMode === 'rotate-placement' || transformMode === 'support-edit';

    if (displayedType === 'model' && !isSpecialMode && modelGroup.models.length && !(modelGroup.models.length === 1 && modelGroup.models[0].type === 'primeTower')) {
        return (
            <React.Fragment>
                <div className={styles['layer-wrapper']}>
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
                            min={qualitySetting.layer_height.default_value}
                            max={primeTowerHeight + qualitySetting.layer_height.default_value}
                            step={qualitySetting.layer_height.default_value}
                            value={value}
                            onChange={(v) => {
                                onChange(v);
                            }}
                        />
                    </div>
                </div>
            </React.Fragment>
        );
    } else {
        return null;
    }
}


export default VisualizerClippingControl;
