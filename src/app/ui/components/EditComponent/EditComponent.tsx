import classNames from 'classnames';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';


import { NumberInput as Input } from '../Input';
import Slider from '../Slider';
import SvgIcon from '../SvgIcon';
import styles from './styles.styl';
import usePrevious from '../../../lib/hooks/previous';

export interface EditComponentProps {
    handleSubmit: (value: number) => void;
    hasSlider?: boolean;
    initValue: number;
    suffix?: string;
    sliderMax?: number;
    sliderMin?: number;
    sliderMarks?: Record<number, React.ReactNode>;
    inputMax?: number;
    inputMin?: number;
    disabled?: boolean;
}

const EditComponent: React.FC<EditComponentProps> = React.memo(({
    handleSubmit,
    hasSlider,
    initValue,
    suffix,
    sliderMax,
    sliderMin,
    sliderMarks,
    inputMax,
    inputMin,
    disabled = false,
}) => {
    const [showOverlay, setShowOverlay] = useState(false);
    const [sliderValue, setSliderValue] = useState(initValue);
    const [inputValue, setInputValue] = useState(initValue);

    const previousShowOverlay = usePrevious(showOverlay);

    // Use first init value
    useEffect(() => {
        if (!previousShowOverlay && showOverlay) {
            setSliderValue(initValue);
            setInputValue(initValue);
        }
    }, [previousShowOverlay, showOverlay, initValue]);

    const handleSliderChange = (value: number) => {
        setSliderValue(value);
        setInputValue(value);
    };

    const handleInputChange = (value: number) => {
        setInputValue(value);
    };

    const handleGlobalClick = useCallback(() => {
        if (!showOverlay) return;
        handleSubmit(inputValue);
        setShowOverlay(false);
    }, [showOverlay, handleSubmit, inputValue]);

    useEffect(() => {
        window.addEventListener('click', handleGlobalClick);
        return () => {
            window.removeEventListener('click', handleGlobalClick);
        };
    }, [handleGlobalClick]);

    return (
        <div className="position-re" onClick={e => e.nativeEvent.stopPropagation()} onKeyDown={noop} role="toolbar">
            <div className="height-percent-100 sm-flex align-flex-end">
                <SvgIcon
                    className="height-24 width-24 border-radius-4 overflow-x-hidden overflow-y-hidden"
                    hoversize={24}
                    name="Edit"
                    type={['hoverNormal', 'pressNormal']}
                    disabled={disabled}
                    onClick={() => { setShowOverlay(!showOverlay); }}
                />
            </div>
            {showOverlay && (
                <div className="position-absolute bottom-0 right-1">
                    <div
                        className={classNames(
                            styles.wrapper, hasSlider && styles['wrapper-with-slide'],
                            'border-radius-8 border-default-black-5 padding-horizontal-4 padding-vertical-4 background-color-white',
                        )}
                    >
                        {hasSlider && (
                            <div className="height-32 margin-left-12">
                                <Slider
                                    max={sliderMax}
                                    min={sliderMin}
                                    size="middle"
                                    className="height-32"
                                    marks={sliderMarks}
                                    value={sliderValue}
                                    onChange={handleSliderChange}
                                />
                            </div>
                        )}
                        <Input
                            value={inputValue}
                            suffix={suffix}
                            max={inputMax}
                            min={inputMin}
                            size="small"
                            onChange={handleInputChange}
                            onPressEnter={() => handleSubmit(inputValue)}
                        />
                    </div>
                    <div className="button-part position-absolute z-index-1 right-1 bottom-minus-34">
                        <div className="margin-right-4 width-30 height-30 border-radius-8 border-default-black-5 background-color-white display-inline">
                            <SvgIcon
                                name="CameraCaptureExtract"
                                hoversize={28}
                                size={18}
                                onClick={() => {
                                    handleSubmit(inputValue);
                                    setShowOverlay(false);
                                }}
                            />
                        </div>
                        <div className="width-30 height-30 border-radius-8 border-default-black-5 background-color-white display-inline">
                            <SvgIcon
                                name="Cancel"
                                hoversize={28}
                                size={18}
                                onClick={() => { setShowOverlay(false); }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.initValue === nextProps.initValue;
});

export default EditComponent;
