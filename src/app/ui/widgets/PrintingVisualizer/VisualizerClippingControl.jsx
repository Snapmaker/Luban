import { Spin } from 'antd';
import { find as lodashFind, throttle } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { LEFT_EXTRUDER } from '../../../constants';
import { actions as printingActions } from '../../../flux/printing';
import workerManager, { WorkerEvents } from '../../../lib/manager/workerManager';
import { ModelEvents } from '../../../models/events';
import { PLANE_MAX_HEIGHT } from '../../../models/ModelGroup';
import Slider from '../../components/Slider';
import styles from './styles.styl';

function VisualizerClippingControl() {
    const transformMode = useSelector(state => state?.printing?.transformMode, shallowEqual);
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const primeTowerHeight = useSelector(state => state?.printing?.primeTowerHeight, shallowEqual);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions, shallowEqual);
    const activePresetIds = useSelector(state => state?.printing?.activePresetIds, shallowEqual);

    const dispatch = useDispatch();

    const activeQualityDefinition = lodashFind(qualityDefinitions, {
        definitionId: activePresetIds[LEFT_EXTRUDER]
    });
    const qualitySetting = activeQualityDefinition?.settings;


    const [value, setValue] = useState(PLANE_MAX_HEIGHT);
    useEffect(() => {
        setValue(primeTowerHeight || PLANE_MAX_HEIGHT);
    }, [primeTowerHeight]);

    const [loading, setLoading] = useState(false);
    useEffect(() => {
        const onClippingHeightReset = () => setValue(PLANE_MAX_HEIGHT);
        modelGroup.on(ModelEvents.ClippingHeightReset, onClippingHeightReset);
        const onClippingStart = () => setLoading(true);
        const onClippingFinish = () => setLoading(false);
        workerManager.on(WorkerEvents.clipperWorkerBusy, onClippingStart);
        workerManager.on(WorkerEvents.clipperWorkerIdle, onClippingFinish);
        workerManager.on(WorkerEvents.clipperWorkerDestroyed, onClippingFinish);

        return () => {
            modelGroup.off(ModelEvents.ClippingHeightReset, onClippingHeightReset);
            workerManager.off(WorkerEvents.clipperWorkerBusy, onClippingStart);
            workerManager.off(WorkerEvents.clipperWorkerIdle, onClippingFinish);
            workerManager.off(WorkerEvents.clipperWorkerDestroyed, onClippingFinish);
        };
    }, []);

    const [isSpecialMode, setIsSpecialMode] = useState(false);
    useEffect(() => {
        if (transformMode === 'rotate-placement' || transformMode === 'support-edit' || transformMode === 'mesh-coloring') {
            workerManager.clipperWorkerEnable = false;
            setIsSpecialMode(true);
        } else {
            workerManager.setClipperWorkerEnable();
            setIsSpecialMode(false);
        }
    }, [transformMode]);

    const update = useRef(throttle((v) => {
        return dispatch(printingActions.updateClippingPlane(v));
    }, 300));

    const onChange = (v) => {
        const height = Number(v.toFixed(2));
        setValue(height);
        update.current(height);
    };

    return (
        <React.Fragment>
            {
                workerManager.clipperWorkerEnable
                && displayedType === 'model'
                && !isSpecialMode
                && modelGroup.models.length
                && !(modelGroup.models.length === 1 && modelGroup.models[0].type === 'primeTower') && (
                    <div className={styles['layer-wrapper']}>
                        {/* <span className={styles['layer-label']}>{value || ''}</span> */}
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
                                    onChange(Number(v));
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
                )
            }
        </React.Fragment>
    );
}

VisualizerClippingControl.propTypes = {
};

export default VisualizerClippingControl;
