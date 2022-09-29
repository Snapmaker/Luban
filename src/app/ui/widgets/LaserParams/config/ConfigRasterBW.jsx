import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import Slider from '../../../components/Slider';
import Checkbox from '../../../components/Checkbox';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput } from '../../../components/Input';
import { actions as editorActions } from '../../../../flux/editor';
import { HEAD_LASER } from '../../../../constants';

const ConfigRasterBW = ({ disabled }) => {
    const dispatch = useDispatch();
    const bwThreshold = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.bwThreshold);
    const invert = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray()[0]?.config?.invert);

    const [tmpBwThreshold, setBwThreshold] = useState(bwThreshold);
    const [expanded, setExpended] = useState(true);

    useEffect(() => {
        setBwThreshold(bwThreshold);
    }, [bwThreshold]);

    const actions = {
        onToggleExpand: () => {
            setExpended(!expanded);
        },
        onInverseBW: () => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { invert: !invert }));
        },
        onChangeBWThreshold: (newBwThreshold) => {
            setBwThreshold(newBwThreshold);
        },
        onAfterChangeBWThreshold: (newBwThreshold = undefined) => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_LASER, { bwThreshold: (newBwThreshold ?? tmpBwThreshold) }));
            dispatch(editorActions.processSelectedModel(HEAD_LASER));
        }
    };

    return (
        <div>
            {expanded && (
                <React.Fragment>
                    <TipTrigger
                        title={i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Invert')}
                        content={i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Inverts the color of images, white becomes black, and black becomes white.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Invert')}</span>
                            <Checkbox
                                disabled={disabled}
                                className="sm-flex-none"
                                checked={invert}
                                onChange={() => {
                                    actions.onInverseBW();
                                    dispatch(editorActions.processSelectedModel(HEAD_LASER));
                                }}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Threshold')}
                        content={i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Set a value above which colors will be rendered in white.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-width">{i18n._('key-Laser/ProcessingModeSection/ConfigRasterBW-Threshold')}</span>
                            <Slider
                                disabled={disabled}
                                size="middle"
                                value={tmpBwThreshold}
                                min={0}
                                max={255}
                                onChange={actions.onChangeBWThreshold}
                                onAfterChange={actions.onAfterChangeBWThreshold}
                                className="padding-right-8"
                            />
                            <NumberInput
                                disabled={disabled}
                                value={tmpBwThreshold}
                                className="sm-flex-none"
                                size="super-small"
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

ConfigRasterBW.propTypes = {
    disabled: PropTypes.bool
};

export default ConfigRasterBW;
