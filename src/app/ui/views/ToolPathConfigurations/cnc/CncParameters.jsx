import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
// import Slider from 'rc-slider';
import Select from '../../../components/Select';
import { CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION,
    TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR,
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION
} from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input, TextInput } from '../../../components/Input';
import widgetStyles from '../../../widgets/styles.styl';
import ToolParameters from './ToolParameters';
import TipTrigger from '../../../components/TipTrigger';
import ToolSelector from './ToolSelector';

class CncParameters extends PureComponent {
    static propTypes = {
        toolDefinitions: PropTypes.array.isRequired,
        activeToolDefinition: PropTypes.object.isRequired,
        isModifiedDefinition: PropTypes.bool.isRequired,
        toolPath: PropTypes.object.isRequired,

        updateToolPath: PropTypes.func.isRequired,
        updateGcodeConfig: PropTypes.func.isRequired,
        updateToolConfig: PropTypes.func.isRequired,
        setCurrentValueAsProfile: PropTypes.func.isRequired,

        size: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired
    };

    state = {
    };

    actions = {
    };


    render() {
        const { toolPath, materials, size } = this.props;

        const { name, type, gcodeConfig } = toolPath;

        const { pathType, sliceMode, smoothY, allowance, targetDepth } = gcodeConfig;

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

        const toolDefinitionToolKeys = [
            'work_speed', 'plunge_speed', 'step_down', 'step_over'
        ];
        const toolDefinitionJogKeys = [
            'jog_speed', 'safetyHeight', 'stopHeight'
        ];
        let toolDefinitionTabKeys = [];
        const useCncTabConfig = toolPath.type === 'vector';
        if (!allDefinition.enableTab.default_value) {
            toolDefinitionTabKeys = [
                'enableTab'
            ];
        } else {
            toolDefinitionTabKeys = [
                'enableTab', 'tabHeight', 'tabSpace', 'tabWidth'
            ];
        }
        const toolDefinitionTool = {};
        toolDefinitionToolKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionTool[key] = allDefinition[key];
            }
        });
        const toolDefinitionJog = {};
        toolDefinitionJogKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionJog[key] = allDefinition[key];
            }
        });
        const toolDefinitionTab = {};
        toolDefinitionTabKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionTab[key] = allDefinition[key];
            }
        });

        return (
            <React.Fragment>
                <div className="sm-parameter-container">
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Name')}</span>
                        <TextInput
                            className="sm-parameter-row__input"
                            style={{ display: 'inline-block', width: '160px', lineHeight: '15px' }}
                            value={name}
                            onChange={(event) => { this.props.updateToolPath({ name: event.target.value }); }}
                        />
                    </div>
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

                            {(methodType === 'Carve' || pathType === 'pocket' || pathType === 'path') && (
                                <TipTrigger
                                    title={i18n._('Target Depth')}
                                    content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                        <Input
                                            disabled={false}
                                            className="sm-parameter-row__input"
                                            style={{ width: '160px' }}
                                            value={targetDepth}
                                            min={0.01}
                                            max={size.z}
                                            step={0.1}
                                            onChange={(value) => { this.props.updateGcodeConfig({ targetDepth: value }); }}
                                        />
                                        <span className="sm-parameter-row__input-unit">mm</span>
                                    </div>
                                </TipTrigger>
                            )}
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
                                    className="sm-parameter-row__input"
                                    value={methodType}
                                    style={{ width: '160px' }}
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
                                            style={{ width: '160px' }}
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

                            {isRotate && sliceMode === CNC_MESH_SLICE_MODE_LINKAGE && (
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label-lg">{i18n._('Y Smoothing')}</span>
                                    <input
                                        disabled={false}
                                        type="checkbox"
                                        className="sm-parameter-row__checkbox"
                                        checked={smoothY}
                                        onChange={() => { this.props.updateGcodeConfig({ smoothY: !smoothY }); }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {!isSVG && (
                        <TipTrigger
                            title={i18n._('Target Depth')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Target Depth')}</span>
                                <Input
                                    disabled={false}
                                    className="sm-parameter-row__input"
                                    value={targetDepth}
                                    min={0.01}
                                    style={{ width: '160px' }}
                                    step={0.1}
                                    max={100}
                                    onChange={(value) => { this.props.updateGcodeConfig({ targetDepth: value }); }}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>
                    )}
                    {!isSVG && (
                        <TipTrigger
                            title={i18n._('Allowance')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Allowance')}</span>
                                <Input
                                    disabled={false}
                                    className="sm-parameter-row__input"
                                    value={allowance}
                                    min={0.00}
                                    style={{ width: '160px' }}
                                    step={0.1}
                                    onChange={(value) => { this.props.updateGcodeConfig({ allowance: value }); }}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>
                    )}
                </div>
                <span>{i18n._('Tool')}</span>
                <div className={classNames(widgetStyles.separator)} style={{ margin: '16px 0' }} />
                <ToolSelector
                    toolDefinition={this.props.activeToolDefinition}
                    toolDefinitions={this.props.toolDefinitions}
                    isModifiedDefinition={this.props.isModifiedDefinition}
                    setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                />
                <ToolParameters
                    settings={toolDefinitionTool}
                    updateToolConfig={this.props.updateToolConfig}
                    updateGcodeConfig={this.props.updateGcodeConfig}
                    toolPath={this.props.toolPath}
                />
                <span>{i18n._('Jog')}</span>
                <div className={classNames(widgetStyles.separator)} style={{ margin: '16px 0' }} />
                <ToolParameters
                    settings={toolDefinitionJog}
                    updateToolConfig={this.props.updateToolConfig}
                    updateGcodeConfig={this.props.updateGcodeConfig}
                    toolPath={this.props.toolPath}
                />
                {useCncTabConfig && (
                    <div>
                        <span>{i18n._('Tab')}</span>
                        <div className={classNames(widgetStyles.separator)} style={{ margin: '16px 0' }} />
                        <ToolParameters
                            settings={toolDefinitionTab}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                        />
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { size } = state.machine;
    const { materials } = state.cnc;
    return {
        size,
        materials
    };
};

export default connect(mapStateToProps, null)(CncParameters);
