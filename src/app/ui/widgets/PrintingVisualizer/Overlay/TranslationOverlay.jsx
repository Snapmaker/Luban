import React, { useState } from 'react';
import { useDispatch, shallowEqual, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import { Button } from '../../../components/Buttons';
import TipTrigger from '../../../components/TipTrigger';
import Select from '../../../components/Select';
import { actions as printingActions } from '../../../../flux/printing';
import { actions as machineActions } from '../../../../flux/machine';

const TranslationOverlay = ({ actions, setTransformMode, transformDisabled, moveX, moveY, CancelButton, hasModels }) => {
    const size = useSelector(state => state?.machine?.size, shallowEqual);
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const printingArrangeSettings = useSelector(state => state?.machine?.printingArrangeSettings, shallowEqual);
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup?.isSupportSelected());
    const [arragneSettings, setArragneSettings] = useState(printingArrangeSettings);
    const dispatch = useDispatch();

    const handleArragneSettingsChange = (settings) => {
        setArragneSettings(settings);
        dispatch(machineActions.updateArrangeSettings(settings));
    };

    return (
        <div
            className="position-ab width-360 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '60px'
            }}
        >
            <div className="sm-flex justify-space-between border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 font-size-middle">
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
                                actions.onModelTransform({ 'moveX': value });
                                actions.onModelAfterTransform();
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
                                actions.onModelTransform({ 'moveY': value });
                                actions.onModelAfterTransform();
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
                            onClick={() => actions.resetPosition(isPrimeTowerSelected)}
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
                                    options={[
                                        {
                                            value: 360,
                                            label: i18n._('key-Printing/LeftBar-No Rotation')
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
                                    ]}
                                    value={arragneSettings.angle}
                                    onChange={(option) => {
                                        handleArragneSettingsChange({
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
                                        handleArragneSettingsChange({
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
                                        handleArragneSettingsChange({
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
                                const {
                                    angle,
                                    offset,
                                    padding
                                } = arragneSettings;
                                dispatch(printingActions.arrangeAllModels(angle, offset, padding));
                            }}
                            disabled={!hasModels || transformDisabled}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Auto Arrange')}</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

TranslationOverlay.propTypes = {
    actions: PropTypes.object.isRequired,
    setTransformMode: PropTypes.func.isRequired,
    transformDisabled: PropTypes.bool.isRequired,
    moveX: PropTypes.number.isRequired,
    moveY: PropTypes.number.isRequired,
    CancelButton: PropTypes.func.isRequired,
    hasModels: PropTypes.bool.isRequired
};

export default TranslationOverlay;
