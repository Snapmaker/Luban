import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import Slider from '../../../components/Slider';
import Select from '../../../components/Select';

import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../../flux/editor';
import { HEAD_LASER } from '../../../../constants';

const ConfigHalftone = ({ disabled }) => {
    const dispatch = useDispatch();
    const npType = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.npType);
    const npSize = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.npSize);
    const npAngle = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.npAngle);
    const threshold = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.threshold);

    const [tmpNpSize, setNpSize] = useState(npSize);
    const [tmpNpAngle, setNpAngle] = useState(npAngle);
    const [tmpThreshold, setThreshold] = useState(threshold);
    const [expanded, setExpended] = useState(true);

    useEffect(() => {
        setNpSize(npSize);
    }, [npSize]);
    useEffect(() => {
        setNpAngle(npAngle);
    }, [npAngle]);
    useEffect(() => {
        setThreshold(threshold);
    }, [threshold]);

    const actions = {
        onToggleExpand: () => {
            setExpended(!expanded);
        },
        onChangeType: (newNpType) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { npType: newNpType }));
        },
        onChangeSize: (newNpSize) => {
            setNpSize(newNpSize);
        },
        onAfterChangeSize: (newNpSize = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { npSize: (newNpSize ?? tmpNpSize) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeAngle: (newNpAngle) => {
            newNpAngle %= 180;
            if (newNpAngle < 0) newNpAngle += 180;
            setNpAngle(newNpAngle);
        },
        onAfterChangeAngle: (newNpAngle) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { npAngle: (newNpAngle ?? tmpNpAngle) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeBWThreshold: (newThreshold) => {
            setThreshold(newThreshold);
        },
        onAfterChangeBWThreshold: (newThreshold = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { threshold: (newThreshold ?? tmpThreshold) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        }
    };

    return (
        <div>
            {expanded && (
                <React.Fragment>
                    <TipTrigger
                        title={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Type')}
                        content={i18n._('Select the way that the dots are arranged.\n- Line: Dots are arranged into lines.\n- Round: Dots are arranged into rounds.\n- Diamond: Dots are arranged into diamonds.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Type')}</span>
                            <Select
                                size="middle"
                                clearable={false}
                                options={[{
                                    value: 'line',
                                    label: i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Line')
                                }, {
                                    value: 'round',
                                    label: i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Round')
                                }, {
                                    value: 'diamond',
                                    label: i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Diamond')
                                }]}
                                value={npType}
                                searchable={false}
                                onChange={({ value }) => {
                                    actions.onChangeType(value);
                                    dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Size')}
                        content={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Set the size of dots.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Size')}</span>
                            <Slider
                                disabled={disabled}
                                size="middle"
                                value={tmpNpSize}
                                min={5}
                                max={50}
                                onChange={actions.onChangeSize}
                                onAfterChange={actions.onAfterChangeSize}
                                className="padding-right-8"
                            />
                            <NumberInput
                                disabled={disabled}
                                size="super-small"
                                value={tmpNpSize}
                                min={5}
                                max={50}
                                onChange={(value) => {
                                    actions.onAfterChangeSize(value);
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Angle')}
                        content={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Set the rotation angle of the halftone image through the arrange of dots.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Angle')}</span>
                            <Slider
                                disabled={disabled}
                                size="middle"
                                value={tmpNpAngle}
                                min={0}
                                max={180}
                                onChange={actions.onChangeAngle}
                                onAfterChange={actions.onAfterChangeAngle}
                                className="padding-right-8"
                            />
                            <NumberInput
                                disabled={disabled}
                                size="super-small"
                                value={tmpNpAngle}
                                min={0}
                                max={180}
                                onChange={(value) => {
                                    actions.onAfterChangeAngle(value);
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Threshold')}
                        content={i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Colors above this value will be rendered in white.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key_ui/widgets/LaserParams/config/ConfigHalftone_Threshold')}</span>
                            <Slider
                                disabled={disabled}
                                size="middle"
                                value={tmpThreshold}
                                min={0}
                                max={255}
                                onChange={actions.onChangeBWThreshold}
                                onAfterChange={actions.onAfterChangeBWThreshold}
                                className="padding-right-8"
                            />
                            <NumberInput
                                disabled={disabled}
                                size="super-small"
                                value={tmpThreshold}
                                min={0}
                                max={255}
                                onChange={(value) => {
                                    actions.onAfterChangeBWThreshold(value);
                                }}
                            />
                        </div>
                    </TipTrigger>
                </React.Fragment>
            )}
        </div>
    );
};

ConfigHalftone.propTypes = {
    disabled: PropTypes.bool
};

export default ConfigHalftone;
