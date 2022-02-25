import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { throttle } from 'lodash';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import Select from '../../../components/Select';
import { actions as printingActions } from '../../../../flux/printing';
import { actions as machineActions } from '../../../../flux/machine';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../VisualizerLeftBar';

const angleOptions = [
    {
        value: 360,
        label: '不旋转'
    },
    {
        value: 20,
        label: '20°'
    },
    {
        value: 30,
        label: '30°'
    },
    {
        value: 36,
        label: '36°'
    },
    {
        value: 45,
        label: '45°'
    },
    {
        value: 60,
        label: '60°'
    },
    {
        value: 90,
        label: '90°'
    },
    {
        value: 180,
        label: '180°'
    }
];
const TranslateOverlay = ({
    setTransformMode,
    onModelAfterTransform,
    arrangeAllModels,
    transformDisabled,
    size,
    hasModels
}) => {
    const printingArrangeSettings = useSelector(state => state?.machine?.printingArrangeSettings, shallowEqual);
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup.isSupportSelected());
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const [moveX, setMoveX] = useState(0);
    const [moveY, setMoveY] = useState(0);
    const [arragneSettings, setArragneSettings] = useState(printingArrangeSettings);
    const dispatch = useDispatch();
    const onModelTransform = (transformations) => {
        const newTransformation = {};
        Object.keys(transformations).forEach(keyItem => {
            let value = transformations[keyItem];
            switch (keyItem) {
                case 'moveX':
                    value = Math.min(Math.max(value, -size.x / 2), size.x / 2);
                    newTransformation.positionX = value;
                    break;
                case 'moveY':
                    value = Math.min(Math.max(value, -size.y / 2), size.y / 2);
                    newTransformation.positionY = value;
                    break;
                default:
                    break;
            }
        });
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
    };
    const resetPosition = (_isPrimeTowerSelected = false) => {
        const { max } = modelGroup._bbox;
        const _moveX = _isPrimeTowerSelected ? max.x - 50 : 0;
        const _moveY = _isPrimeTowerSelected ? max.y - 50 : 0;
        onModelTransform({
            'moveX': _moveX,
            'moveY': _moveY
        });
        onModelAfterTransform();
    };
    const handleArrangeSettingsChange = (settings) => {
        setArragneSettings(settings);
        dispatch(machineActions.updateArrangeSettings(settings));
    };

    const updatePosition = (detail) => {
        throttle(() => {
            setMoveX(Math.round(detail.position.x * 10) / 10);
            setMoveY(Math.round(detail.position.y * 10) / 10);
        }, 1000)();
    };
    useEffect(() => {
        window.addEventListener('update-position', ({ detail }) => {
            updatePosition(detail);
        });
        return () => {
            window.removeEventListener('update-position', ({ detail }) => {
                updatePosition(detail);
            });
        };
    }, []);
    useEffect(() => {
        if (selectedModelArray.length >= 1) {
            setMoveX(Math.round(transformation.positionX * 10) / 10);
            setMoveY(Math.round(transformation.positionY * 10) / 10);
        }
    }, [selectedModelArray]);

    return (
        <div
            className="position-ab width-360 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '60px'
            }}
        >
            <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                {i18n._('key-Printing/LeftBar-Move')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-10 padding-horizontal-16 height-40">
                {i18n._('key-Printing/LeftBar-Model position')}
            </div>
            <div className="padding-vertical-16 padding-horizontal-16 ">
                <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                    <span className="sm-flex-auto color-red-1">X</span>
                    <div className="sm-flex-auto">
                        <Input
                            suffix="mm"
                            size="small"
                            disabled={transformDisabled}
                            min={-size.x / 2}
                            max={size.x / 2}
                            value={moveX}
                            onChange={(value) => {
                                onModelTransform({ 'moveX': value });
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                    <span className="sm-flex-auto color-green-1">Y</span>
                    <div className="sm-flex-auto">
                        <Input
                            suffix="mm"
                            size="small"
                            disabled={transformDisabled}
                            min={-size.y / 2}
                            max={size.y / 2}
                            value={moveY}
                            onChange={(value) => {
                                onModelTransform({ 'moveY': value });
                                onModelAfterTransform();
                            }}
                        />
                    </div>
                </div>
                {!isSupportSelected && (
                    <div className="sm-flex">
                        <Button
                            className="margin-vertical-16"
                            type="primary"
                            priority="level-three"
                            width="100%"
                            disabled={transformDisabled}
                            onClick={() => resetPosition(isPrimeTowerSelected)}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Move to Center')}</span>
                        </Button>
                    </div>
                )}
                <div className="border-top-normal padding-vertical-10 padding-horizontal-16 height-40">
                    {i18n._('key-Printing/LeftBar-Arrange Options')}
                </div>
                <div className="padding-top-16 padding-horizontal-16">
                    <TipTrigger
                        title={i18n._('key-Printing/LeftBar-Rotation Step Around Z Axis')}
                        content={i18n._('key-Printing/LeftBar-Rotation Step Around Z Axis Content')}
                        placement="right"
                    >
                        <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                            <span>
                                {i18n._('key-Printing/LeftBar-Rotation Step Around Z Axis')}
                            </span>
                            <div>
                                <Select
                                    size="middle"
                                    options={angleOptions}
                                    value={arragneSettings.angle}
                                    onChange={(option) => {
                                        handleArrangeSettingsChange({
                                            ...arragneSettings,
                                            angle: option.value
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-Printing/LeftBar-Min Model Distance')}
                        content={i18n._('key-Printing/LeftBar-Min Model Distance Content')}
                        placement="right"
                    >
                        <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                            <span>
                                {i18n._('key-Printing/LeftBar-Min Model Distance')}
                            </span>
                            <div>
                                <Input
                                    suffix="mm"
                                    size="small"
                                    min={1}
                                    value={arragneSettings.offset}
                                    onChange={(offset) => {
                                        handleArrangeSettingsChange({
                                            ...arragneSettings,
                                            offset
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-Printing/LeftBar-X & Y Margins')}
                        content={i18n._('key-Printing/LeftBar-X & Y Margins Content')}
                        placement="right"
                    >
                        <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                            <span>
                                {i18n._('key-Printing/LeftBar-X & Y Margins')}
                            </span>
                            <div>
                                <Input
                                    suffix="mm"
                                    size="small"
                                    min={0}
                                    value={arragneSettings.padding}
                                    onChange={(padding) => {
                                        handleArrangeSettingsChange({
                                            ...arragneSettings,
                                            padding
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </TipTrigger>
                    <div className="sm-flex">
                        <Button
                            className="margin-top-32"
                            type="primary"
                            priority="level-three"
                            width="100%"
                            onClick={() => {
                                const { angle, offset, padding } = arragneSettings;
                                arrangeAllModels(angle, offset, padding);
                            }}
                            disabled={!hasModels}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Auto Arrange')}</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

TranslateOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    onModelAfterTransform: PropTypes.func.isRequired,
    arrangeAllModels: PropTypes.func.isRequired,
    transformDisabled: PropTypes.bool.isRequired,
    size: PropTypes.object.isRequired,
    hasModels: PropTypes.bool.isRequired
};
export default TranslateOverlay;
