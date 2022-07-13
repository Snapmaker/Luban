import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { shallowEqual, useSelector } from 'react-redux';
import { Slider } from 'antd';
import { Button } from '../../../components/Buttons';
import { NumberInput as Input } from '../../../components/Input';
import Anchor from '../../../components/Anchor';
import i18n from '../../../../lib/i18n';
import styles from './styles.styl';
// import SliderWrapper from '../../../components/Slider';

const SimplifyModelOverlay = ({ handleApplySimplify, handleCancelSimplify, handleUpdateSimplifyConfig }) => {
    const simplifyType = useSelector(state => state.printing.simplifyType, shallowEqual);
    const simplifyPercent = useSelector(state => state.printing.simplifyPercent, shallowEqual);
    const [sliderValue, setSliderValue] = useState(simplifyPercent);
    useEffect(() => {
        setSliderValue(simplifyPercent);
    }, [simplifyPercent]);
    const handleSimplifyPercentUpdate = (value) => {
        setSliderValue(value);
        handleUpdateSimplifyConfig(0, value);
    };

    const handleSimplifyTypeUpdate = (type) => {
        handleUpdateSimplifyConfig(type);
    };
    return (
        <div className="position-ab width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-12 padding-horizontal-16')}>
                {i18n._('key-Printing/LeftBar-Simplify model')}
            </div>
            <div className="sm-flex justify-space-between padding-top-8 padding-horizontal-16 padding-bottom-24">
                <Anchor key={0} onClick={() => handleSimplifyTypeUpdate(0)}>
                    <div className="simplify-type-0">
                        <div className={`width-120 border-default-grey-1 ${simplifyType === 0 ? 'border-color-blue-2' : ''} border-radius-8`}>
                            <img src="/resources/images/3dp/low-ploygon.png" alt="" className="width-percent-100" />
                        </div>
                        <div className={`${simplifyType === 0 ? 'color-blue' : ''} width-120 text-overflow-ellipsis`}>{i18n._('key-Printing/LeftBar-Simplify low ploygon')}</div>
                    </div>
                </Anchor>
                <Anchor key={1} onClick={() => handleSimplifyTypeUpdate(1)}>
                    <div className="simplify-type-1">
                        <div className={`width-120 border-default-grey-1 ${simplifyType === 1 ? 'border-color-blue-2' : ''} border-radius-8`}>
                            <img src="/resources/images/3dp/detail-rabbit.png" alt="" className="width-percent-100" />
                        </div>
                        <div className={`${simplifyType === 1 ? 'color-blue' : ''} width-120 text-overflow-ellipsis`}>{i18n._('key-Printing/LeftBar-Simplify length')}</div>
                    </div>
                </Anchor>

            </div>
            {simplifyType === 0 && (
                <div className="padding-horizontal-16 padding-top-8">
                    <div>{i18n._('key-Printing/LeftBar-Simplify percent')}</div>
                    <div className="sm-flex justify-space-between padding-top-8 padding-bottom-24">
                        <Slider min={1} max={100} value={sliderValue} onChange={(value) => setSliderValue(value)} onAfterChange={handleSimplifyPercentUpdate} style={{ width: 120 }} />
                        <Input
                            suffix="%"
                            value={sliderValue}
                            onChange={(value) => handleSimplifyPercentUpdate(value)}
                            size="small"
                            min={1}
                            max={100}
                        />
                    </div>
                </div>
            )}
            <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-space-between">
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
