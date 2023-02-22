import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { shallowEqual, useSelector } from 'react-redux';
import { Slider } from 'antd';
import { Button } from '../../components/Buttons';
import { NumberInput as Input } from '../../components/Input';
import Anchor from '../../components/Anchor';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import TipTrigger from '../../components/TipTrigger';

// import SliderWrapper from '../../../components/Slider';

const SimplifyModelOverlay = ({ handleApplySimplify, handleCancelSimplify, handleUpdateSimplifyConfig }) => {
    const simplifyType = useSelector(state => state.printing.simplifyType, shallowEqual);
    const simplifyPercent = useSelector(state => state.printing.simplifyPercent, shallowEqual);
    const [sliderValue, setSliderValue] = useState(simplifyPercent);
    useEffect(() => {
        setSliderValue(simplifyPercent);
    }, [simplifyPercent]);
    const handleSimplifyPercentUpdate = (value) => {
        value = Math.round(value);
        setSliderValue(value);
        handleUpdateSimplifyConfig(0, value);
    };

    const handleSimplifyTypeUpdate = (type) => {
        handleUpdateSimplifyConfig(type);
    };
    return (
        <div className="position-absolute width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-12 padding-horizontal-16')}>
                {i18n._('key-3DP/MainToolBar-Model Simplify')}
            </div>
            <div className="sm-flex justify-space-between padding-top-8 padding-horizontal-16 padding-bottom-24">
                <TipTrigger
                    overlayClassName="simplify-overlay-tip"
                    title={i18n._('key-Printing/LeftBar-Simplify by Custom Rate')}
                    content={(
                        <div style={{ width: '270px' }}>
                            {i18n._('key-Printing/LeftBar-Adjust the simplification rate to customize the effect. The higher the simplification rate, the simpler the model will be.')}
                        </div>
                    )}
                    placement="right"
                >
                    <Anchor key={0} onClick={() => handleSimplifyTypeUpdate(0)}>
                        <div className="simplify-type-0">
                            <div className={`width-118 border-default-grey-1 ${simplifyType === 0 ? 'border-color-blue-2' : ''} border-radius-8`}>
                                <img src="/resources/images/3dp/low-ploygon.png" alt="" className="width-percent-100" />
                            </div>
                            <div className={`${simplifyType === 0 ? 'color-blue' : ''} width-118 align-c`}>{i18n._('key-Printing/LeftBar-Simplify by Custom Rate')}</div>
                        </div>
                    </Anchor>
                </TipTrigger>
                <TipTrigger
                    overlayClassName="simplify-overlay-tip"
                    title={i18n._('key-Printing/LeftBar-Simplify by Layer Height')}
                    content={(
                        <div style={{ width: '270px' }}>
                            <p>{i18n._('key-Printing/LeftBar-Merge polygons in the 3D mesh based on the layer height. This can optimize the model for better printing while preserve as many detalis as possible.')}</p>
                        </div>
                    )}
                    placement="right"
                >
                    <Anchor key={1} onClick={() => handleSimplifyTypeUpdate(1)}>
                        <div className="simplify-type-1">
                            <div className={`width-118 border-default-grey-1 ${simplifyType === 1 ? 'border-color-blue-2' : ''} border-radius-8`}>
                                <img src="/resources/images/3dp/detail-rabbit.png" alt="" className="width-percent-100" />
                            </div>
                            <div className={`${simplifyType === 1 ? 'color-blue' : ''} width-118 align-c`}>{i18n._('key-Printing/LeftBar-Simplify by Layer Height')}</div>
                        </div>
                    </Anchor>
                </TipTrigger>
            </div>
            {simplifyType === 0 && (
                <div className="padding-horizontal-16">
                    <div>{i18n._('key-Printing/LeftBar-Simplification Rate')}</div>
                    <div className="sm-flex justify-space-between padding-top-8 padding-bottom-20">
                        <Slider
                            min={1}
                            max={100}
                            value={sliderValue}
                            onChange={(value) => setSliderValue(value)}
                            onAfterChange={handleSimplifyPercentUpdate}
                            style={{
                                width: 120,
                                marginLeft: 0,
                                marginRight: 0
                            }}
                        />
                        <Input
                            suffix="%"
                            value={sliderValue}
                            onChange={(value) => handleSimplifyPercentUpdate(value)}
                            size="small"
                            min={1}
                            max={100}
                            decimalPlaces={0}
                        />
                    </div>
                </div>
            )}
            <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-space-between border-radius-bottom-8">
                <Button
                    onClick={handleCancelSimplify}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-Modal/Common-Cancel')}
                </Button>
                <Button
                    priority="level-two"
                    width="96px"
                    onClick={handleApplySimplify}
                >
                    {i18n._('key-Laser/CameraCapture-Apply')}
                </Button>
            </div>
        </div>
    );
};

SimplifyModelOverlay.propTypes = {
    handleApplySimplify: PropTypes.func,
    handleCancelSimplify: PropTypes.func,
    handleUpdateSimplifyConfig: PropTypes.func
};
export default SimplifyModelOverlay;
