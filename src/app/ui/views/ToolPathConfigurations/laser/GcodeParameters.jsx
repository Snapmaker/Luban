import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { isNil } from 'lodash';
// import Slider from '../../../components/Slider';
import {
    TOOLPATH_TYPE_IMAGE,
    TOOLPATH_TYPE_VECTOR,
    LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION
} from '../../../../constants';
import i18n from '../../../../lib/i18n';
import SvgIcon from '../../../components/SvgIcon';
import ToolParameters from '../cnc/ToolParameters';

class GcodeParameters extends PureComponent {
    static propTypes = {
        toolPath: PropTypes.object.isRequired,

        updateGcodeConfig: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    render() {
        const { toolPath } = this.props;

        const { type, gcodeConfig } = toolPath;

        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;

        const { fillEnabled, movementMode,
            multiPasses, fixedPowerEnabled } = gcodeConfig;

        // Todo
        const isMethodFill = (fillEnabled === 'true' || fillEnabled === true);

        const gcodeDefinition = LASER_DEFAULT_GCODE_PARAMETERS_DEFINITION;
        Object.keys(gcodeDefinition).forEach((key) => {
            if (!isNil(gcodeConfig[key])) {
                gcodeDefinition[key].default_value = gcodeConfig[key];
            }
            // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
            gcodeDefinition[key].isGcodeConfig = true;
        });

        // Session Fill
        const laserDefinitionFillKeys = [];
        const laserDefinitionFill = {};
        if (!isSVG || isMethodFill) {
            laserDefinitionFillKeys.push('movementMode');
            if (isImage) {
                if (movementMode === 'greyscale-line') {
                    laserDefinitionFillKeys.push('direction');
                }
                laserDefinitionFillKeys.push('fillInterval');
            }
            if (isSVG) {
                laserDefinitionFillKeys.push('fillInterval');
            }
            laserDefinitionFillKeys.forEach((key) => {
                if (gcodeDefinition[key]) {
                    laserDefinitionFill[key] = gcodeDefinition[key];
                }
                if (key === 'movementMode') {
                    if (isSVG) {
                        laserDefinitionFill[key].options = {
                            'greyscale-line': 'Line'
                        };
                    } else {
                        laserDefinitionFill[key].options = {
                            'greyscale-line': 'Line',
                            'greyscale-dot': 'Dot'
                        };
                    }
                }
            });
        }

        // Session Speed
        const laserDefinitionSpeedKeys = ['jogSpeed'];
        if (isMethodFill || movementMode === 'greyscale-line') {
            laserDefinitionSpeedKeys.push('workSpeed');
        }
        if (movementMode === 'greyscale-dot') {
            laserDefinitionSpeedKeys.push('dwellTime');
        }
        const laserDefinitionSpeed = {};
        laserDefinitionSpeedKeys.forEach((key) => {
            if (gcodeDefinition[key]) {
                laserDefinitionSpeed[key] = gcodeDefinition[key];
            }
        });

        // Session Repetition
        const laserDefinitionRepetitionKeys = [];
        const laserDefinitionRepetition = {};
        if (isSVG && !isMethodFill) {
            laserDefinitionRepetitionKeys.push('multiPasses');
            if (multiPasses > 1) {
                laserDefinitionRepetitionKeys.push('multiPassDepth');
            }
            laserDefinitionRepetitionKeys.forEach((key) => {
                if (gcodeDefinition[key]) {
                    laserDefinitionRepetition[key] = gcodeDefinition[key];
                }
            });
        }

        // Session Power
        const laserDefinitionPowerKeys = ['fixedPower'];
        const laserDefinitionPower = {};
        laserDefinitionPowerKeys.forEach((key) => {
            if (gcodeDefinition[key]) {
                laserDefinitionPower[key] = gcodeDefinition[key];
            }
        });

        return (
            <React.Fragment>
                {(!isSVG || isMethodFill) && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Fill')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionFill}
                            updateToolConfig={() => {}}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
                <div>
                    <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                        <SvgIcon
                            name="TitleSetting"
                            size={24}
                        />
                        <span>{i18n._('Speed')}</span>
                    </div>
                    <ToolParameters
                        settings={laserDefinitionSpeed}
                        updateToolConfig={() => {}}
                        updateGcodeConfig={this.props.updateGcodeConfig}
                        toolPath={this.props.toolPath}
                        styleSize="large"
                    />
                </div>
                {isSVG && !isMethodFill && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Pass')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionRepetition}
                            updateToolConfig={() => {}}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
                {fixedPowerEnabled !== undefined && (
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Power')}</span>
                        </div>
                        <ToolParameters
                            settings={laserDefinitionPower}
                            updateToolConfig={() => {}}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                            styleSize="large"
                        />
                    </div>
                )}
            </React.Fragment>
        );
    }
}

export default GcodeParameters;
