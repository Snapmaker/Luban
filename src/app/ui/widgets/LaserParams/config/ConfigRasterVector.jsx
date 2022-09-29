import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import Slider from '../../../components/Slider';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { actions as editorActions } from '../../../../flux/editor';
import { HEAD_LASER } from '../../../../constants';

const ConfigRasterVector = ({ disabled }) => {
    const dispatch = useDispatch();
    const vectorThreshold = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.vectorThreshold);
    const invert = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.invert);
    const turdSize = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.turdSize);

    const [tmpVectorThreshold, setVectorThreshold] = useState(vectorThreshold);
    const [expanded, setExpended] = useState(true);

    useEffect(() => {
        setVectorThreshold(vectorThreshold);
    }, [vectorThreshold]);

    const actions = {
        onToggleExpand: () => {
            setExpended(!expanded);
        },
        onChangeVectorThreshold: (newVectorThreshold) => {
            setVectorThreshold(newVectorThreshold);
        },
        onAfterChangeVectorThreshold: (newVectorThreshold = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { vectorThreshold: (newVectorThreshold ?? tmpVectorThreshold) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        },
        onChangeTurdSize: (newTurdSize) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { turdSize: newTurdSize }));
        },
        onToggleInvert: () => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { invert: !invert }));
        }
    };

    return (
        <div>
            {expanded && (
                <React.Fragment>
                    <TipTrigger
                        title={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Invert')}
                        content={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Inverts the color of images, white becomes black, and black becomes white.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Invert')}</span>
                            <Checkbox
                                disabled={disabled}
                                className="sm-flex-none"
                                checked={invert}
                                onChange={() => {
                                    actions.onToggleInvert();
                                    dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Threshold')}
                        content={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Set a value above which colors will be rendered in white.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Threshold')}</span>

                            <Slider
                                disabled={disabled}
                                size="middle"
                                value={tmpVectorThreshold}
                                min={0}
                                max={255}
                                step={1}
                                onChange={actions.onChangeVectorThreshold}
                                onAfterChange={actions.onAfterChangeVectorThreshold}
                                className="padding-right-8"
                            />
                            <Input
                                disabled={disabled}
                                size="super-small"
                                value={tmpVectorThreshold}
                                min={0}
                                max={255}
                                onChange={async (value) => {
                                    actions.onAfterChangeVectorThreshold(value);
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Impurity Size')}
                        content={i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Set the minimum size of impurities allowed to be shown.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigRasterVector-Impurity Size')}</span>
                            <Input
                                disabled={disabled}
                                value={turdSize}
                                min={0}
                                max={10000}
                                onChange={(value) => {
                                    actions.onChangeTurdSize(value);
                                    dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                }}
                            />
                        </div>
                    </TipTrigger>
                </React.Fragment>

            )}
        </div>
    );
};

ConfigRasterVector.propTypes = {
    disabled: PropTypes.bool
};

export default ConfigRasterVector;
