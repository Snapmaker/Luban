import React, { useState, useEffect, useRef } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { find as lodashFind, noop, throttle } from 'lodash';
import PropTypes from 'prop-types';
import { Spin } from 'antd';
import Slider from '../../components/Slider';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import { ModelEvents } from '../../../models/events';
import { PLANE_MAX_HEIGHT } from '../../../models/ModelGroup';

function VisualizerClippingControl({ simplifying }) {
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

    const [loading, setLoading] = useState(false);
    useEffect(() => {
        modelGroup.on(ModelEvents.ClippingHeightReset, () => {
            setValue(PLANE_MAX_HEIGHT);
        });
        modelGroup.on(ModelEvents.ClippingStart, () => {
            setLoading(true);
        });
        modelGroup.on(ModelEvents.ClippingFinish, () => {
            setLoading(false);
        });
        return () => {
            modelGroup.off(ModelEvents.ClippingHeightReset, noop);
            modelGroup.off(ModelEvents.ClippingStart, noop);
            modelGroup.off(ModelEvents.ClippingFinish, noop);
        };
    }, []);

    const update = useRef(throttle((v) => {
        return dispatch(printingActions.updateClippingPlane(v));
    }, 300));

    const onChange = (v) => {
        const height = Number(v.toFixed(2));
        setValue(height);
        update.current(height);
    };

    const isSpecialMode = transformMode === 'rotate-placement' || transformMode === 'support-edit';

    if (!simplifying && displayedType === 'model' && !isSpecialMode && modelGroup.models.length && !(modelGroup.models.length === 1 && modelGroup.models[0].type === 'primeTower')) {
        return (
            <React.Fragment>
                <div className={styles['layer-wrapper']}>
                    <span className={styles['layer-label']}>{value || ''}</span>
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
                        {/* Placeholder by setting the height of the div */}
                        <div style={{ position: 'relative', left: -3, height: '23.22px' }}>
                            {
                                loading
                                && <Spin />
                            }
                        </div>

                    </div>
                </div>
            </React.Fragment>
        );
    } else {
        return null;
    }
}
VisualizerClippingControl.propTypes = {
    simplifying: PropTypes.bool.isRequired,
};

export default VisualizerClippingControl;
