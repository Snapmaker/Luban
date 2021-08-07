import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from '../../../components/Select';
import { CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION,
    TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR,
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION
} from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { TextInput } from '../../../components/Input';
import ToolParameters from './ToolParameters';
import TipTrigger from '../../../components/TipTrigger';
import ToolSelector from './ToolSelector';
import SvgIcon from '../../../components/SvgIcon';

class CncParameters extends PureComponent {
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
    };

    render() {
        const { toolPath, materials, multipleEngine } = this.props;

        const { name, type, gcodeConfig, useLegacyEngine } = toolPath;

        const { pathType, sliceMode } = gcodeConfig;

        const { isRotate } = materials;

        const sliceModeOptions = [{
            value: CNC_MESH_SLICE_MODE_ROTATION,
            label: 'Rotation'
        }, {
            value: CNC_MESH_SLICE_MODE_LINKAGE,
            label: 'Linkage'
        }
        ];

        const methodType = type === TOOLPATH_TYPE_VECTOR ? 'Contour' : 'Carve';
        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;
        const isSculpt = type === TOOLPATH_TYPE_SCULPT;

        const gcodeDefinition = CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION;
        Object.keys(gcodeDefinition).forEach((key) => {
            gcodeDefinition[key].default_value = gcodeConfig[key];
            // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
            gcodeDefinition[key].isGcodeConfig = true;
        });
        const allDefinition = {
            ...gcodeDefinition,
            ...this.props.activeToolDefinition.settings
        };
        // Session First
        const toolDefinitionFirstKeys = [];
        if (isSVG || isImage || isSculpt && !isRotate && methodType === 'Carve') {
            toolDefinitionFirstKeys.push('targetDepth');
        }
        if (methodType === 'Carve' || sliceMode === CNC_MESH_SLICE_MODE_ROTATION || sliceMode === CNC_MESH_SLICE_MODE_LINKAGE) {
            toolDefinitionFirstKeys.push('allowance');
        }
        const toolDefinitionFirst = {};
        toolDefinitionFirstKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionFirst[key] = allDefinition[key];
            }
        });

        // Session Tool
        const toolDefinitionToolKeys = [
            'work_speed', 'plunge_speed', 'step_down', 'step_over'
        ];
        const toolDefinitionTool = {};
        toolDefinitionToolKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionTool[key] = allDefinition[key];
            }
        });

        // Session Jog
        const toolDefinitionJogKeys = [
            'jog_speed', 'safetyHeight', 'stopHeight'
        ];
        const toolDefinitionJog = {};
        toolDefinitionJogKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionJog[key] = allDefinition[key];
            }
        });

        // Session Tab
        let toolDefinitionTabKeys = [];
        const toolDefinitionTab = {};
        const useCncTabConfig = pathType === 'path' || pathType === 'outline';
        if (useCncTabConfig) {
            if (!allDefinition.enableTab.default_value) {
                toolDefinitionTabKeys = [
                    'enableTab'
                ];
            } else {
                toolDefinitionTabKeys = [
                    'enableTab', 'tabHeight', 'tabSpace', 'tabWidth'
                ];
            }
            toolDefinitionTabKeys.forEach((key) => {
                if (allDefinition[key]) {
                    toolDefinitionTab[key] = allDefinition[key];
                }
            });
        }

        return (
            <React.Fragment>
                <div className="border-default-grey-1 border-radius-8 padding-vertical-8 padding-horizontal-16">
                    <div className="sm-parameter-container">
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Name')}</span>
                            <TextInput
                                className="sm-parameter-row__input"
                                size="large"
                                value={name}
                                onChange={(event) => { this.props.updateToolPath({ name: event.target.value }); }}
                            />
                        </div>
                        {multipleEngine && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Use legacy engine')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={useLegacyEngine}
                                    onChange={() => { this.props.updateToolPath({ useLegacyEngine: !useLegacyEngine }); }}
                                />
                            </div>
                        )}
                        {isSVG && (
                            <div>
                                <TipTrigger
                                    title={i18n._('method')}
                                    content={(
                                        <div>
                                            <p>{i18n._('Select a carving path:')}</p>
                                            <ul>
                                                <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
                                                <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
                                                <li><b>{i18n._('Fill')}</b>: {i18n._('Carve away the inner of the image.')}</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <div>
                                        <span
                                            style={{ height: '30px', lineHeight: '30px' }}
                                        >
                                            {i18n._('Method')}
                                        </span>
                                        <Select
                                            disabled={false}
                                            size="large"
                                            className={classNames(
                                                'sm-parameter-row__select-md',
                                            )}
                                            backspaceRemoves={false}
                                            clearable={false}
                                            menuContainerStyle={{ zIndex: 5 }}
                                            name="carvePath"
                                            options={[
                                                {
                                                    label: i18n._('On the Path'),
                                                    value: 'path'
                                                },
                                                {
                                                    label: i18n._('Outline'),
                                                    value: 'outline'
                                                },
                                                {
                                                    label: i18n._('Fill'),
                                                    value: 'pocket'
                                                }
                                            ]}
                                            placeholder={i18n._('Choose carving path')}
                                            value={pathType}
                                            onChange={(option) => { this.props.updateGcodeConfig({ pathType: option.value }); }}
                                        />
                                    </div>
                                </TipTrigger>
                            </div>
                        )}
                        {isImage && (
                            <TipTrigger
                                title={i18n._('Method')}
                                content={i18n._('Method')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Method')}</span>
                                    <TextInput
                                        disabled
                                        size="large"
                                        className="sm-parameter-row__input"
                                        value={methodType}
                                    />
                                </div>
                            </TipTrigger>
                        )}
                        {isSculpt && (
                            <div>
                                {!isRotate && (
                                    <TipTrigger
                                        title={i18n._('Method')}
                                        content={i18n._('Method')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('Method')}</span>
                                            <TextInput
                                                disabled
                                                className="sm-parameter-row__input"
                                                value={methodType}
                                                size="large"
                                            />
                                        </div>
                                    </TipTrigger>
                                )}
                                {isRotate && (
                                    <React.Fragment>
                                        <TipTrigger
                                            title={i18n._('Slicing Mode')}
                                            content={i18n._('Select the slicing mode of the mesh toolpath')}
                                        >
                                            <div className="sm-parameter-row">
                                                <span className="sm-parameter-row__label">{i18n._('Method')}</span>
                                                <Select
                                                    disabled={false}
                                                    size="large"
                                                    className="sm-parameter-row__select-md"
                                                    backspaceRemoves={false}
                                                    clearable={false}
                                                    searchable={false}
                                                    options={sliceModeOptions}
                                                    value={sliceMode}
                                                    onChange={(option) => { this.props.updateGcodeConfig({ sliceMode: option.value }); }}
                                                />
                                            </div>
                                        </TipTrigger>
                                    </React.Fragment>
                                )}
                                {/* {isRotate && sliceMode === CNC_MESH_SLICE_MODE_LINKAGE && (*/}
                                {/*    <div className="position-re sm-flex justify-space-between height-32 margin-vertical-8">*/}
                                {/*        <span>{i18n._('Y Smoothing')}</span>*/}
                                {/*        <input*/}
                                {/*            disabled={false}*/}
                                {/*            type="checkbox"*/}
                                {/*            className="sm-flex-auto"*/}
                                {/*            checked={smoothY}*/}
                                {/*            onChange={() => { this.props.updateGcodeConfig({ smoothY: !smoothY }); }}*/}
                                {/*        />*/}
                                {/*    </div>*/}
                                {/* )}*/}
                            </div>
                        )}
                        <ToolParameters
                            settings={toolDefinitionFirst}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                        />
                    </div>
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Tool')}</span>
                        </div>
                        <ToolSelector
                            toolDefinition={this.props.activeToolDefinition}
                            toolDefinitions={this.props.toolDefinitions}
                            setCurrentToolDefinition={this.props.setCurrentToolDefinition}
                            isModifiedDefinition={this.props.isModifiedDefinition}
                            setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                        />
                        <ToolParameters
                            settings={toolDefinitionTool}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                        />
                    </div>
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Jog')}</span>
                        </div>
                        <ToolParameters
                            settings={toolDefinitionJog}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                        />
                    </div>
                    {useCncTabConfig && (
                        <div>
                            <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                                <SvgIcon
                                    name="TitleSetting"
                                    size={24}
                                />
                                <span>{i18n._('Tab')}</span>
                            </div>
                            <div>
                                <ToolParameters
                                    settings={toolDefinitionTab}
                                    updateToolConfig={this.props.updateToolConfig}
                                    updateGcodeConfig={this.props.updateGcodeConfig}
                                    toolPath={this.props.toolPath}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { multipleEngine } = state.machine;
    const { materials } = state.cnc;
    return {
        multipleEngine,
        materials
    };
};

export default connect(mapStateToProps, null)(CncParameters);
