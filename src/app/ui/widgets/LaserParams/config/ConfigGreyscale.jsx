import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import Slider from '../../../components/Slider';
import Select from '../../../components/Select';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../../flux/editor';
import { HEAD_LASER } from '../../../../constants';

const ConfigGreyscale = ({ disabled }) => {
    const dispatch = useDispatch();

    const invert = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.invert);
    const contrast = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.contrast);
    const brightness = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.brightness);
    const whiteClip = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.whiteClip);
    const greyscaleAlgorithm = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.greyscaleAlgorithm);
    const algorithm = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.algorithm);

    const [expanded, setExpended] = useState(true);
    const [tmpContrast, setContrast] = useState(contrast);
    const [tmpBrightness, setBrightness] = useState(brightness);
    const [tmpWhiteClip, setWhiteClip] = useState(whiteClip);

    useEffect(() => {
        setContrast(contrast);
    }, [contrast]);
    useEffect(() => {
        setBrightness(brightness);
    }, [brightness]);
    useEffect(() => {
        setWhiteClip(whiteClip);
    }, [whiteClip]);

    const actions = {
        onToggleExpand: () => {
            setExpended(!expanded);
        },
        onInverseBW: () => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { invert: !invert }));
        },
        onChangeContrast: (newContrast) => {
            setContrast(newContrast);
        },
        onAfterChangeContrast: (newContrast = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { contrast: (newContrast ?? tmpContrast) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeBrightness: (newBrightness) => {
            setBrightness(newBrightness);
        },
        onAfterChangeBrightness: (newBrightness = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { brightness: (newBrightness ?? tmpBrightness) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeWhiteClip: (newWhiteClip) => {
            setWhiteClip(newWhiteClip);
        },
        onAfterChangeWhiteClip: (newWhiteClip) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { whiteClip: (newWhiteClip ?? tmpWhiteClip) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeAlgorithm: (options) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { algorithm: options.value }));
        },
        onChangeGreyscaleAlgorithm: (options) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { greyscaleAlgorithm: options.value }));
        }
    };

    return (
        <div>
            {expanded && (
                <React.Fragment>
                    <div>
                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Invert')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Inverts the color of images, white becomes black, and black becomes white.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Invert')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
                                    checked={invert}
                                    onChange={() => {
                                        actions.onInverseBW();
                                        dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Contrast')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Set the disparity between darkness and brightness.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Contrast')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={tmpContrast}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeContrast}
                                    onAfterChange={actions.onAfterChangeContrast}
                                    className="padding-right-8"
                                />
                                <Input
                                    disabled={disabled}
                                    size="super-small"
                                    value={tmpContrast}
                                    min={0}
                                    max={100}
                                    onChange={(value) => {
                                        actions.onAfterChangeContrast(value);
                                    }}
                                />
                            </div>
                        </TipTrigger>

                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Brightness')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Set the brightness of the image. The bigger the value is, the brighter the image will be.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Brightness')}</span>
                                <Slider
                                    size="middle"
                                    disabled={disabled}
                                    value={tmpBrightness}
                                    min={0}
                                    max={100}
                                    onChange={actions.onChangeBrightness}
                                    onAfterChange={actions.onAfterChangeBrightness}
                                    className="padding-right-8"
                                />
                                <Input
                                    disabled={disabled}
                                    size="super-small"
                                    value={tmpBrightness}
                                    min={0}
                                    max={100}
                                    onChange={(value) => {
                                        actions.onAfterChangeBrightness(value);
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-White Clip')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Set the threshold to turn the color that is not pure white into pure white. Zero is taken to be black, and 255 is taken to be white. Colors above this value will be rendered into pure white.')}
                        >

                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-White Clip')}</span>
                                <Slider
                                    disabled={disabled}
                                    size="middle"
                                    value={tmpWhiteClip}
                                    min={0}
                                    max={255}
                                    onChange={actions.onChangeWhiteClip}
                                    onAfterChange={actions.onAfterChangeWhiteClip}
                                    className="padding-right-8"
                                />
                                <Input
                                    disabled={disabled}
                                    size="super-small"
                                    value={tmpWhiteClip}
                                    min={0}
                                    max={255}
                                    onChange={(value) => {
                                        actions.onAfterChangeWhiteClip(value);
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Greyscale-Conversion')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Select an algorithm for image processing.')}
                        >

                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Greyscale-Conversion')}</span>
                                <Select
                                    disabled={disabled}
                                    size="large"
                                    clearable={false}
                                    name="greyscaleAlgorithm"
                                    options={[{
                                        value: 'Luma',
                                        label: 'Luma'
                                    }, {
                                        value: 'Luminance',
                                        label: 'Luminance'
                                    }, {
                                        value: 'Luster',
                                        label: 'Luster'
                                    }]}
                                    placeholder=""
                                    searchable={false}
                                    value={greyscaleAlgorithm}
                                    onChange={(value) => {
                                        actions.onChangeGreyscaleAlgorithm(value);
                                        dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                    }}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Algorithm')}
                            content={i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Select an algorithm for image processing.')}
                        >

                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigGreyscale-Algorithm')}</span>
                                <Select
                                    disabled={disabled}
                                    size="large"
                                    clearable={false}
                                    name="algorithm"
                                    options={[
                                        {
                                            value: 'None',
                                            label: 'None'
                                        }, {
                                            value: 'Atkinson',
                                            label: 'Atkinson'
                                        }, {
                                            value: 'Burkes',
                                            label: 'Burkes'
                                        }, {
                                            value: 'FloydSteinburg',
                                            label: 'Floyd-Steinburg'
                                        }, {
                                            value: 'JarvisJudiceNinke',
                                            label: 'Jarvis-Judice-Ninke'
                                        }, {
                                            value: 'Stucki',
                                            label: 'Stucki'
                                        }, {
                                            value: 'Sierra2',
                                            label: 'Sierra-2'
                                        }, {
                                            value: 'Sierra3',
                                            label: 'Sierra-3'
                                        }, {
                                            value: 'SierraLite',
                                            label: 'Sierra Lite'
                                        }]}
                                    placeholder=""
                                    searchable={false}
                                    value={algorithm}
                                    onChange={(value) => {
                                        actions.onChangeAlgorithm(value);
                                        dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                    }}
                                />
                            </div>
                        </TipTrigger>
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

ConfigGreyscale.propTypes = {
    disabled: PropTypes.bool
};

export default ConfigGreyscale;
