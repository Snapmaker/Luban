import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { throttle } from 'lodash';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import Select from '../../components/Select';
import { actions as printingActions } from '../../../flux/printing';
import { actions as machineActions } from '../../../flux/machine';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../../widgets/PrintingVisualizer/VisualizerLeftBar';
import { emitUpdateControlInputEvent } from '../../components/SMCanvas/TransformControls';
import { HEAD_PRINTING, TRANSLATE_MODE } from '../../../constants';
import styles from './styles.styl';
import { logTransformOperation } from '../../../lib/gaEvent';

const angleOptions = [
    {
        value: 360,
        label: 'key-Printing/LeftBar-No Rotation'
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
const TranslateOverlay = React.memo(({
    setTransformMode,
    onModelAfterTransform,
    arrangeAllModels,
    size,
    hasModels
}) => {
    const printingArrangeSettings = useSelector(state => state?.machine?.printingArrangeSettings, shallowEqual);
    const isSupportSelected = useSelector(state => state?.printing?.modelGroup.isSupportSelected());
    const isPrimeTowerSelected = useSelector(state => state?.printing?.modelGroup?.isPrimeTowerSelected());
    const modelGroup = useSelector(state => state?.printing?.modelGroup);
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const isSelectedModelAllVisible = useSelector(state => state?.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);

    const [moveX, setMoveX] = useState(0);
    const [moveY, setMoveY] = useState(0);
    const [arragneSettings, setArragneSettings] = useState(printingArrangeSettings);
    const dispatch = useDispatch();
    const onModelTransform = (transformations, isReset) => {
        const newTransformation = {};
        const updateControlValue = {};
        let updateAxis = null;
        Object.keys(transformations).forEach(keyItem => {
            let value = transformations[keyItem];
            switch (keyItem) {
                case 'moveX':
                    value = Math.min(Math.max(value, -size.x / 2), size.x / 2);
                    newTransformation.positionX = value;
                    updateControlValue.x = value;
                    updateAxis = 'x';
                    break;
                case 'moveY':
                    value = Math.min(Math.max(value, -size.y / 2), size.y / 2);
                    newTransformation.positionY = value;
                    updateControlValue.y = value;
                    updateAxis = 'y';
                    break;
                default:
                    break;
            }
        });
        !isReset && logTransformOperation(HEAD_PRINTING, 'move', 'input');
        dispatch(printingActions.updateSelectedModelTransformation(newTransformation));
        emitUpdateControlInputEvent({
            controlValue: {
                mode: TRANSLATE_MODE,
                data: updateControlValue,
                axis: isReset ? undefined : updateAxis
            }
        });
    };
    const resetPosition = (_isPrimeTowerSelected = false) => {
        const { max } = modelGroup._bbox;
        const _moveX = _isPrimeTowerSelected ? max.x - 50 : 0;
        const _moveY = _isPrimeTowerSelected ? max.y - 50 : 0;
        onModelTransform({
            'moveX': _moveX,
            'moveY': _moveY
        }, true);
        logTransformOperation(HEAD_PRINTING, 'move', 'center');
        onModelAfterTransform();
    };
    const handleArrangeSettingsChange = (settings) => {
        setArragneSettings(settings);
        dispatch(machineActions.updateArrangeSettings(settings));
    };

    const updatePosition = throttle((event) => {
        const { detail } = event;
        setMoveX(detail.position.x);
        setMoveY(detail.position.y);
    }, 1000);
    useEffect(() => {
        window.addEventListener('update-position', updatePosition);
        return () => {
            window.removeEventListener('update-position', updatePosition);
        };
    }, []);
    useEffect(() => {
        if (selectedModelArray.length >= 1) {
            setMoveX(Math.round(transformation.positionX * 10) / 10);
            setMoveY(Math.round(transformation.positionY * 10) / 10);
        } else {
            setMoveX(0);
            setMoveY(0);
        }
    }, [selectedModelArray]);

    return (
        <div
            className="position-absolute width-328 margin-left-72 padding-bottom-16 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '60px'
            }}
        >
            <div
                className={classNames(
                    styles['overlay-title-font'],
                    'sm-flex justify-space-between',
                    'border-bottom-normal padding-horizontal-16 height-40',
                )}
            >
                {i18n._('key-Printing/LeftBar-Move')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className={classNames(styles['overlay-sub-title-font'], 'padding-top-12 padding-horizontal-16')}>
                {i18n._('key-Printing/LeftBar-Model position')}
            </div>
            <div className="padding-top-8 padding-horizontal-16">
                <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                    <span className="sm-flex-auto color-red-1">X</span>
                    <div className="sm-flex-auto margin-left-n-28">
                        <Input
                            suffix="mm"
                            size="small"
                            disabled={!isSelectedModelAllVisible && !isPrimeTowerSelected}
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
                    <div className="sm-flex-auto margin-left-n-28">
                        <Input
                            suffix="mm"
                            size="small"
                            disabled={!isSelectedModelAllVisible && !isPrimeTowerSelected}
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
                            className="margin-top-16"
                            type="primary"
                            priority="level-three"
                            width="100%"
                            disabled={
                                (selectedModelArray.length === 0 && !isPrimeTowerSelected)
                                || (selectedModelArray.length > 0 && !isPrimeTowerSelected && !isSelectedModelAllVisible)
                            }
                            onClick={() => resetPosition(isPrimeTowerSelected)}
                        >
                            <span>{i18n._('key-Printing/LeftBar-Move to Center')}</span>
                        </Button>
                    </div>
                )}
                <div className={classNames(styles['dashed-line'])} />
                <div className={classNames(styles['overlay-sub-title-font'], 'padding-vertical-8')}>
                    {i18n._('key-Printing/LeftBar-Arrange Options')}
                </div>
                <div>
                    <TipTrigger
                        title={i18n._('key-Printing/LeftBar-Rotation Step Around Z Axis')}
                        content={i18n._('key-Printing/LeftBar-Rotation Step Around Z Axis Content')}
                        placement="right"
                    >
                        <div className="sm-flex justify-space-between height-32 margin-bottom-8">
                            <span className="max-width-160 text-overflow-ellipsis">
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
                                    size="middle"
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
                                    size="middle"
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
                            className="margin-top-16"
                            type="primary"
                            priority="level-three"
                            width="100%"
                            onClick={() => {
                                const { angle, offset, padding } = arragneSettings;
                                arrangeAllModels(angle, offset, padding);
                                logTransformOperation(HEAD_PRINTING, 'move', 'arrange');
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
});

TranslateOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    onModelAfterTransform: PropTypes.func.isRequired,
    arrangeAllModels: PropTypes.func.isRequired,
    size: PropTypes.object.isRequired,
    hasModels: PropTypes.bool.isRequired
};
export default TranslateOverlay;
