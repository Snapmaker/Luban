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
        label: i18n._('key-Cnc/StlSection/orientation_Front-Front')
    }, {
        value: BACK,
        label: i18n._('key-Cnc/StlSection/orientation_Back-Back')
    }, {
        value: LEFT,
        label: i18n._('key-Cnc/StlSection/orientation_Left-Left')
    }, {
        value: RIGHT,
        label: i18n._('key-Cnc/StlSection/orientation_Right-Right')
    }, {
        value: TOP,
        label: i18n._('key-Cnc/StlSection/orientation_Top-Top')
    }, {
        value: BOTTOM,
        label: i18n._('key-Cnc/StlSection/orientation_Bottom-Bottom')
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
                <span className="sm-flex-width heading-3">{i18n._('key-Cnc/Edit/stlParameters-Model')}</span>
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
                                title={i18n._('key-Cnc/Edit/stlParameters-Projection Orientation 3axis')}
                                content={i18n._('key-Cnc/Edit/stlParameters-Set the projection orientation of the 3D model.3axis')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-none sm-flex-order-negative width-56">{i18n._('key-Cnc/Edit/stlParameters-Orientation')}</span>
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
                                title={i18n._('key-Cnc/Edit/stlParameters-Placement Face 4aixs')}
                                content={i18n._('key-Cnc/Edit/stlParameters-Set the placement orientation of the 3D model.4axis')}
                            >
                                <div className="sm-flex height-32 margin-vertical-8">
                                    <span className="sm-flex-none sm-flex-order-negative width-56">{i18n._('key-Cnc/Edit/stlParameters-Orientation')}</span>
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
                            title={i18n._('key-Cnc/Edit/stlParameters-Image Density')}
                            content={i18n._('key-Cnc/Edit/stlParameters-Set the resolution of the grayscale image generated by the 3D model.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-none sm-flex-order-negative">{i18n._('key-Cnc/Edit/stlParameters-Image Density')}</span>
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
