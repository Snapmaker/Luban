import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cloneDeep } from 'lodash';
import { TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_VECTOR, LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION } from '../../../../constants';
import i18n from '../../../../lib/i18n';
import SvgIcon from '../../../components/SvgIcon';
import ToolParameters from '../cnc/ToolParameters';
import { toHump } from '../../../../../shared/lib/utils';
import PresentSelector from './PresentSelector';

class GcodeParameters extends PureComponent {
    static propTypes = {
        toolPath: PropTypes.object.isRequired,
        activeToolDefinition: PropTypes.object.isRequired,
        updateGcodeConfig: PropTypes.func.isRequired,
        updateToolConfig: PropTypes.func.isRequired,

        toolDefinitions: PropTypes.array.isRequired,
        setCurrentToolDefinition: PropTypes.func.isRequired,
        isModifiedDefinition: PropTypes.bool.isRequired,
        setCurrentValueAsProfile: PropTypes.func.isRequired,
        isModel: PropTypes.bool,
        zOffsetEnabled: PropTypes.bool,
        halfDiodeModeEnabled: PropTypes.bool,
        auxiliaryAirPumpEnabled: PropTypes.bool,
    };

    state = {
    };

    actions = {
    };

    render() {
        const { toolPath, activeToolDefinition } = this.props;
        const {
            zOffsetEnabled = true,
            halfDiodeModeEnabled = false,
            auxiliaryAirPumpEnabled = false,
        } = this.props;

        const { type, gcodeConfig } = toolPath;

        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;

        const allDefinition = LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION;
        Object.keys(allDefinition).forEach((key) => {
            allDefinition[key].default_value = gcodeConfig[key];
            // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
            allDefinition[key].isGcodeConfig = false;
        });

        Object.entries(cloneDeep(activeToolDefinition?.settings)).forEach(([key, value]) => {
            if (!allDefinition[toHump(key)]) {
                allDefinition[toHump(key)] = {};
            }
            allDefinition[toHump(key)].default_value = value.default_value;
        });

        const pathType = allDefinition.pathType.default_value;
        const movementMode = allDefinition.movementMode.default_value;
        const multiPasses = allDefinition.multiPasses.default_value;
        const fixedPowerEnabled = allDefinition.fixedPowerEnabled.default_value;

        // section Method
        const laserDefinitionMethod = {
            'pathType': allDefinition.pathType
        };

        // section Fill
        const laserDefinitionFillKeys = [];
        const laserDefinitionFill = {};
        if (pathType === 'fill') {
            laserDefinitionFillKeys.push('movementMode');
            if (isSVG) {
                laserDefinitionFillKeys.push('fillInterval');
                if (movementMode === 'greyscale-line') {
                    laserDefinitionFillKeys.push('direction');
                }
            } else if (isImage) {
                if (movementMode !== 'greyscale-dot') {
                    laserDefinitionFillKeys.push('direction');
                }
                laserDefinitionFillKeys.push('fillInterval');
            }
        }
        laserDefinitionFillKeys.forEach((key) => {
            if (allDefinition[key]) {
                laserDefinitionFill[key] = allDefinition[key];
            }
            if (key === 'movementMode') {
                if (isSVG) {
                    laserDefinitionFill[key].options = {
                        'greyscale-line': 'Line',
                        'greyscale-dot': 'Dot'
                    };
                } else {
                    laserDefinitionFill[key].options = {
                        'greyscale-line': 'Line',
                        'greyscale-dot': 'Dot'
                    };
                }
            }
        });

        // section Speed
        const laserDefinitionSpeedKeys = ['jogSpeed'];
        if (pathType === 'fill' && movementMode !== 'greyscale-dot') {
            laserDefinitionSpeedKeys.push('workSpeed');
        } else if (pathType === 'path') {
            laserDefinitionSpeedKeys.push('workSpeed');
        }
        if (pathType === 'fill' && movementMode === 'greyscale-dot') {
            laserDefinitionSpeedKeys.push('dwellTime');
        }
        const laserDefinitionSpeed = {};
        laserDefinitionSpeedKeys.forEach((key) => {
            if (allDefinition[key]) {
                laserDefinitionSpeed[key] = allDefinition[key];
            }
        });

        // section Pass
        const laserDefinitionRepetitionKeys = [];
        const laserDefinitionRepetition = {};
        if (pathType === 'path') {
            if (zOffsetEnabled) {
                laserDefinitionRepetitionKeys.push('initialHeightOffset');
            }
            laserDefinitionRepetitionKeys.push('multiPasses');
            if (zOffsetEnabled && multiPasses > 1) {
                laserDefinitionRepetitionKeys.push('multiPassDepth');
            }
            laserDefinitionRepetitionKeys.forEach((key) => {
                if (allDefinition[key]) {
                    laserDefinitionRepetition[key] = allDefinition[key];
                }
            });
        }

        // section Power
        const laserDefinitionPowerKeys = ['fixedPower', 'constantPowerMode'];
        if (halfDiodeModeEnabled) {
            laserDefinitionPowerKeys.push('halfDiodeMode');
        }

        // if (pathType === 'fill' && movementMode === 'greyscale-variable-line') {
        //     laserDefinitionPowerKeys.push('fixedMinPower');
        // laserDefinitionPowerKeys.push('powerLevelDivisions');
        // }
        const laserDefinitionPower = {};
        laserDefinitionPowerKeys.forEach((key) => {
            if (allDefinition[key]) {
                laserDefinitionPower[key] = allDefinition[key];
            }
        });

        // section Auxiliary Gas
        const laserDefinitionAuxiliaryGasKeys = ['auxiliaryAirPump'];
        const laserDefinitionAuxiliary = {};
        laserDefinitionAuxiliaryGasKeys.forEach((key) => {
            if (allDefinition[key]) {
                laserDefinitionAuxiliary[key] = allDefinition[key];
            }
        });

        return (
            <React.Fragment>
                <div>
                    <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                        <SvgIcon
                            name="TitleSetting"
                            type={['static']}
                            size={24}
                        />
                        <span>{i18n._('Preset')}</span>
                    </div>
                    <PresentSelector
                        toolDefinition={this.props.activeToolDefinition}
                        toolDefinitions={this.props.toolDefinitions}
                        setCurrentToolDefinition={this.props.setCurrentToolDefinition}
                        isModifiedDefinition={this.props.isModifiedDefinition}
                        setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                        isModel={this.props.isModel}
                    />
                    <ToolParameters
                        settings={laserDefinitionMethod}
                        updateToolConfig={this.props.updateToolConfig}
                        updateGcodeConfig={this.props.updateGcodeConfig}
                        toolPath={this.props.toolPath}
                        styleSize="large"
                    />
                </div>
                {(pathType === 'fill') && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                                type={['static']}
                            />
                            <span>{i18n._('key-Laser/ToolpathParameters-Fill')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionFill}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
                <div>
                    <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                        <SvgIcon
                            name="TitleSetting"
                            size={24}
                            type={['static']}
                        />
                        <span>{i18n._('key-Laser/ToolpathParameters-Speed')}</span>
                    </div>
                    <ToolParameters
                        settings={laserDefinitionSpeed}
                        updateToolConfig={this.props.updateToolConfig}
                        updateGcodeConfig={this.props.updateGcodeConfig}
                        toolPath={this.props.toolPath}
                        styleSize="large"
                    />
                </div>
                {pathType === 'path' && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                                size={24}
                            />
                            <span>{i18n._('key-Laser/ToolpathParameters-Repetition')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionRepetition}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
                {fixedPowerEnabled !== undefined && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                                size={24}
                            />
                            <span>{i18n._('key-Laser/ToolpathParameters-Power')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionPower}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
                {
                    auxiliaryAirPumpEnabled && (
                        <div>
                            <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                <span>{i18n._('key-Laser/ToolpathParameters-Auxiliary Gas')}</span>
                            </div>
                            <ToolParameters
                                settings={laserDefinitionAuxiliary}
                                updateToolConfig={this.props.updateToolConfig}
                                updateGcodeConfig={this.props.updateGcodeConfig}
                                toolPath={this.props.toolPath}
                                styleSize="large"
                            />
                        </div>
                    )
                }
            </React.Fragment>
        );
    }
}

export default GcodeParameters;
