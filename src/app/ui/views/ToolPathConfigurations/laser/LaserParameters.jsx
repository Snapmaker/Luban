import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from '../../../components/Select';
import { TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { TextInput } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import GcodeParameters from './GcodeParameters';
import SvgIcon from '../../../components/SvgIcon';
import PresentSelector from './PresentSelector';

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
        materials: PropTypes.object.isRequired
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
                option.jogSpeed = 2500;
                option.workSpeed = 2500;
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
            // if (option.fillEnabled === true) {
            //     option.fillInterval = 0.25;
            //     option.jogSpeed = 3000;
            //     option.workSpeed = 500;
            //     option.fixedPower = 100;
            //     option.multiPasses = 1;
            // }
            // if (option.fillEnabled === false) {
            //     option.jogSpeed = 3000;
            //     option.workSpeed = 140;
            //     option.multiPasses = 2;
            //     option.multiPassDepth = 0.6;
            //     option.fixedPower = 100;
            // }

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
        const { toolPath, multipleEngine, activeToolDefinition } = this.props;

        const { name, type, useLegacyEngine, gcodeConfig } = toolPath;

        // TODO: fill method into a param
        const fillEnabled = (activeToolDefinition?.settings['fill_enabled']['default_value'] ?? gcodeConfig.fillEnabled);

        // eslint-disable-next-line no-unused-vars
        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;
        const defaultFillEnabled = true;
        // TODO: fill method into a param
        const fillMethod = ((fillEnabled === 'true' || fillEnabled === true) ? 'fill' : 'path');

        return (
            <React.Fragment>
                <div className="border-default-grey-1 border-radius-8 padding-vertical-8 padding-horizontal-16">
                    <div className="sm-parameter-container">
                        <TipTrigger
                            title={i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Name')}
                            content={i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Enter the toolpath name.')}
                        >
                            <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Name')}</span>
                                <TextInput
                                    size="large"
                                    value={name}
                                    onChange={(event) => { this.props.updateToolPath({ name: event.target.value }); }}
                                />
                            </div>
                        </TipTrigger>
                        <div>
                            <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                <span>{i18n._('Present')}</span>
                            </div>
                            <PresentSelector
                                toolDefinition={this.props.activeToolDefinition}
                                toolDefinitions={this.props.toolDefinitions}
                                setCurrentToolDefinition={this.props.setCurrentToolDefinition}
                                isModifiedDefinition={this.props.isModifiedDefinition}
                                setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                            />
                        </div>
                        {multipleEngine && (
                            <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Use legacy engine')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={useLegacyEngine}
                                    onChange={() => { this.props.updateToolPath({ useLegacyEngine: !useLegacyEngine }); }}
                                />
                            </div>
                        )}
                        <div>
                            {isSVG && (
                                <TipTrigger
                                    title={i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Method')}
                                    content={(
                                        <div>
                                            <p>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Set the processing method of the object.')}</p>
                                            <ul>
                                                <li><b>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Fill')}</b>: {i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Fills the object with lines or dots.')}</li>
                                                <li><b>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_On the Path')}</b>: {i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Engraves along the shape of the object.')}</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                                        <span>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Method')}</span>
                                        <Select
                                            size="large"
                                            backspaceRemoves={false}
                                            className="sm-parameter-row__select-md"
                                            clearable={false}
                                            menuContainerStyle={{ zIndex: 5 }}
                                            name="method"
                                            options={[{
                                                value: 'fill',
                                                label: i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Fill')
                                            }, {
                                                value: 'path',
                                                label: i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_On the Path')
                                            }]}
                                            value={fillMethod}
                                            onChange={(option) => { this.actions.updateGcodeConfig({ fillEnabled: option.value === 'fill' }); }}
                                        />
                                    </div>
                                </TipTrigger>
                            )}
                            {isImage && (
                                <TipTrigger
                                    title={i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Method')}
                                    content={i18n._('Set the processing method of the object. \n - Fill: Fills the object with lines or dots.')}
                                >
                                    <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                                        <span>{i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Method')}</span>
                                        <Select
                                            size="large"
                                            backspaceRemoves={false}
                                            className="sm-parameter-row__select-md"
                                            clearable={false}
                                            menuContainerStyle={{ zIndex: 5 }}
                                            name="method"
                                            options={[{
                                                value: true,
                                                label: i18n._('key_ui/views/ToolPathConfigurations/laser/LaserParameters_Fill')
                                            }]}
                                            placeholder=""
                                            searchable={false}
                                            value={defaultFillEnabled}
                                            onChange={() => {}}
                                            disabled="true"
                                        />
                                    </div>
                                </TipTrigger>
                            )}
                        </div>
                    </div>
                    <GcodeParameters
                        toolPath={this.props.toolPath}
                        activeToolDefinition={this.props.activeToolDefinition}
                        updateGcodeConfig={this.actions.updateGcodeConfig}
                        updateToolConfig={this.actions.updateToolConfig}
                    />
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { multipleEngine } = state.machine;
    const { materials } = state.laser;
    return {
        multipleEngine,
        materials
    };
};

export default connect(mapStateToProps, null)(LaserParameters);
