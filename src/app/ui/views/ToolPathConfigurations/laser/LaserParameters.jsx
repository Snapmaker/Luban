import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import { connect } from 'react-redux';

import i18n from '../../../../lib/i18n';
import GcodeParameters from './GcodeParameters';
import { TextInput } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../../machines/snapmaker-2-toolheads';

class LaserParameters extends PureComponent {
    static propTypes = {
        toolDefinitions: PropTypes.array.isRequired,
        activeToolDefinition: PropTypes.object.isRequired,
        isModifiedDefinition: PropTypes.bool.isRequired,
        toolPath: PropTypes.object.isRequired,

        setCurrentToolDefinition: PropTypes.func.isRequired,
        updateToolPath: PropTypes.func.isRequired,
        updateGcodeConfig: PropTypes.func.isRequired,
        updateToolConfig: PropTypes.func.isRequired,
        setCurrentValueAsProfile: PropTypes.func.isRequired,

        // size: PropTypes.object.isRequired,
        multipleEngine: PropTypes.bool.isRequired,
        materials: PropTypes.object.isRequired,
        isModel: PropTypes.bool,

        activeMachine: PropTypes.object,
        toolHeadIdentifier: PropTypes.string,
    };

    state = {
    };

    actions = {
        onChangeMovementMode: (options) => {
            if (options.value === 'greyscale-line') {
                this.props.updateGcodeConfig({
                    dwellTime: 42,
                    jogSpeed: 1500,
                    workSpeed: 500,
                    fixedPower: 50,
                    movementMode: options.value
                });
            } else if (options.value === 'greyscale-dot') {
                this.props.updateGcodeConfig({
                    dwellTime: 42,
                    jogSpeed: 1500,
                    workSpeed: 1500,
                    fixedPower: 30,
                    movementMode: options.value
                });
            }
        },
        updateToolConfig: (key, value) => {
            this.props.updateToolConfig(key, value);
        },

        // only used in setting item
        // option has only one pair (key, value)
        updateGcodeConfig: (option) => {
            // Movement Mode
            if (option.movementMode === 'greyscale-dot') {
                option.dwellTime = 5;
                option.fillInterval = 0.14;
                option.jogSpeed = 3000;
                // option.workSpeed = 2500;
                option.fixedPower = 60;
            }
            if (option.movementMode === 'greyscale-line') {
                option.direction = (!this.props.toolPath.materials?.isRotate ? 'Horizontal' : 'Vertical');
                option.fillInterval = 0.25;
                option.jogSpeed = 3000;
                option.workSpeed = 500;
                option.fixedPower = 100;
            }

            // Fill Enabled
            if (option.pathType === true) {
                option.fillInterval = 0.25;
                option.jogSpeed = 3000;
                option.workSpeed = 500;
                option.fixedPower = 100;
                option.multiPasses = 1;
            }
            if (option.pathType === false) {
                option.jogSpeed = 3000;
                option.workSpeed = 140;
                option.multiPasses = 2;
                option.multiPassDepth = 0.6;
                option.fixedPower = 100;
            }

            // Fiexd Power Enabled
            if (option.fixedPower && option.fixedPower > 0) {
                option.fixedPowerEnabled = true;
            } else {
                option.fixedPowerEnabled = false;
            }
            this.props.updateGcodeConfig(option);
        }
    };

    render() {
        const { toolPath, multipleEngine, activeMachine, toolHeadIdentifier } = this.props;

        const { useLegacyEngine, name } = toolPath;

        const zOffsetEnabled = activeMachine.metadata.size.z > 0;
        const halfDiodeModeEnabled = includes([L40WLaserToolModule.identifier], toolHeadIdentifier);
        const auxiliaryAirPumpEnabled = includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolHeadIdentifier);

        return (
            <React.Fragment>
                <div className="border-default-grey-1 border-radius-8 padding-vertical-8 padding-horizontal-16">
                    <div className="sm-parameter-container">
                        {multipleEngine && (
                            <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('key-Laser/ToolpathParameters-Use legacy engine')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={useLegacyEngine}
                                    onChange={() => { this.props.updateToolPath({ useLegacyEngine: !useLegacyEngine }); }}
                                />
                            </div>
                        )}
                    </div>
                    <TipTrigger
                        title={i18n._('key-Laser/ToolpathParameters-Name')}
                        content={i18n._('key-Laser/ToolpathParameters-Enter the toolpath name.')}
                        maxWidth="middle"
                    >
                        <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                            <span>{i18n._('key-Laser/ToolpathParameters-Name')}</span>
                            <TextInput
                                size="large"
                                value={name}
                                onChange={(event) => { this.props.updateToolPath({ name: event.target.value }); }}
                            />
                        </div>
                    </TipTrigger>
                    <GcodeParameters
                        toolPath={this.props.toolPath}
                        activeToolDefinition={this.props.activeToolDefinition}
                        updateGcodeConfig={this.actions.updateGcodeConfig}
                        updateToolConfig={this.actions.updateToolConfig}
                        toolDefinitions={this.props.toolDefinitions}
                        isModifiedDefinition={this.props.isModifiedDefinition}
                        setCurrentToolDefinition={this.props.setCurrentToolDefinition}
                        setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                        isModel={this.props.isModel}
                        zOffsetEnabled={zOffsetEnabled}
                        halfDiodeModeEnabled={halfDiodeModeEnabled}
                        auxiliaryAirPumpEnabled={auxiliaryAirPumpEnabled}
                    />
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const activeMachine = state.machine.activeMachine;
    const { multipleEngine, toolHead } = state.machine;
    const { materials } = state.laser;
    return {
        multipleEngine,
        materials,
        activeMachine,
        toolHeadIdentifier: toolHead.laserToolhead,
    };
};

export default connect(mapStateToProps, null)(LaserParameters);
