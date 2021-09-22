import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import Select from '../../components/Select';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { actions as editorActions } from '../../../flux/editor';
import { NumberInput as Input } from '../../components/Input';
import { BACK, BOTTOM, FRONT, LEFT, RIGHT, TOP, HEAD_CNC } from '../../../constants';
import styles from '../CncLaserShared/styles.styl';
import SvgIcon from '../../components/SvgIcon';

const Image3dParameters = ({ config, disabled, updateSelectedModelConfig }) => {
    const dispatch = useDispatch();
    const materials = useSelector(state => state?.cnc?.materials);
    const [expanded, setExpanded] = useState(true);

    const { direction, placement, sliceDensity } = config;

    const Options = [{
        value: FRONT,
        label: 'Front'
    }, {
        value: BACK,
        label: 'Back'
    }, {
        value: LEFT,
        label: 'Left'
    }, {
        value: RIGHT,
        label: 'Right'
    }, {
        value: TOP,
        label: 'Top'
    }, {
        value: BOTTOM,
        label: 'Bottom'
    }];

    const actions = {
        onToggleExpand: () => {
            setExpanded(!expanded);
        },
        onChangeDirectionFace: (option) => {
            updateSelectedModelConfig({ direction: option.value });
        },
        onChangePlacementFace: (option) => {
            updateSelectedModelConfig({ placement: option.value });
        },
        onChangeMinGray: (newMinGray) => {
            updateSelectedModelConfig({ minGray: newMinGray });
        },
        onChangeMaxGray: (newMaxGray) => {
            updateSelectedModelConfig({ maxGray: newMaxGray });
        },
        onChangeSliceDensityGray: (newSliceDensity) => {
            updateSelectedModelConfig({ sliceDensity: newSliceDensity });
        }
    };

    return (
        <div className={classNames(styles['cnc-mode'], 'border-top-normal', 'margin-top-16')}>
            <Anchor className="sm-flex height-32 margin-vertical-8" onClick={actions.onToggleExpand}>
                <span className="sm-flex-width heading-3">{i18n._('key_ui/widgets/CNCPath/Image3dParameters_Model')}</span>
                <SvgIcon
                    name="DropdownLine"
                    size={24}
                    type={['static']}
                    className={classNames(
                        expanded ? '' : 'rotate180'
                    )}
                />
            </Anchor>
            {expanded && (
                <div className="margin-vertical-8">
                    <React.Fragment>
                        {!materials.isRotate && (
                            <TipTrigger
                                title={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Projection Orientation')}
                                content={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Set the projection orientation of the 3D model.')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('key_ui/widgets/CNCPath/Image3dParameters_Orientation')}</span>
                                    <Select
                                        disabled={disabled}
                                        className="sm-flex-width align-r"
                                        size="120px"
                                        backspaceRemoves={false}
                                        clearable={false}
                                        options={Options}
                                        value={direction}
                                        onChange={(option) => {
                                            actions.onChangeDirectionFace(option);
                                            dispatch(editorActions.processSelectedModel(HEAD_CNC));
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        {materials.isRotate && (
                            <TipTrigger
                                title={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Placement Face')}
                                content={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Set the placement orientation of the 3D model.')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('key_ui/widgets/CNCPath/Image3dParameters_Orientation')}</span>
                                    <Select
                                        disabled={disabled}
                                        className="sm-flex-width align-r"
                                        size="120px"
                                        clearable={false}
                                        options={Options}
                                        value={placement}
                                        onChange={(option) => {
                                            actions.onChangePlacementFace(option);
                                            dispatch(editorActions.processSelectedModel(HEAD_CNC));
                                        }}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        <TipTrigger
                            title={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Image Density')}
                            content={i18n._('key_ui/widgets/CNCPath/Image3dParameters_Set the resolution of the grayscale image generated by the 3D model.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-auto sm-flex-order-negative">{i18n._('key_ui/widgets/CNCPath/Image3dParameters_Image Density')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-flex-width align-r"
                                    value={sliceDensity}
                                    min={1}
                                    max={20}
                                    step={1}
                                    onChange={(option) => {
                                        actions.onChangeSliceDensityGray(option);
                                        dispatch(editorActions.processSelectedModel(HEAD_CNC));
                                    }}
                                />
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                </div>
            )}
        </div>
    );
};

Image3dParameters.propTypes = {
    disabled: PropTypes.bool,
    config: PropTypes.shape({
        direction: PropTypes.string,
        placement: PropTypes.string,
        minGray: PropTypes.number,
        maxGray: PropTypes.number,
        sliceDensity: PropTypes.number
    }),
    updateSelectedModelConfig: PropTypes.func.isRequired
};

export default Image3dParameters;
