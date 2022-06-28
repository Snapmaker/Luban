import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { cloneDeep } from 'lodash';
import Select from '../../../components/Select';
import {
    CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION,
    TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR,
    CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION
} from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { TextInput } from '../../../components/Input';
import ToolParameters from './ToolParameters';
import TipTrigger from '../../../components/TipTrigger';
import ToolSelector from './ToolSelector';
import { toHump } from '../../../../../shared/lib/utils';
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
        materials: PropTypes.object.isRequired,
        isModel: PropTypes.bool.isRequired
    };

    state = {
    };

    actions = {
    };

    render() {
        const { toolPath, materials, multipleEngine, isModel } = this.props;

        const { name, type, gcodeConfig, useLegacyEngine } = toolPath;

        const { pathType, sliceMode } = gcodeConfig;

        const { isRotate } = materials;

        const sliceModeOptions = [{
            value: CNC_MESH_SLICE_MODE_ROTATION,
            label: i18n._('key-Cnc/ToolpathParameters-Rotation')
        }, {
            value: CNC_MESH_SLICE_MODE_LINKAGE,
            label: i18n._('key-Cnc/ToolpathParameters-Linkage')
        }
        ];

        const methodType = type === TOOLPATH_TYPE_VECTOR ? i18n._('key-Cnc/ToolpathParameters-Outline') : i18n._('key-Cnc/ToolpathParameters-Carve');
        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;
        const isSculpt = type === TOOLPATH_TYPE_SCULPT;

        const gcodeDefinition = CNC_DEFAULT_GCODE_PARAMETERS_DEFINITION;
        Object.keys(gcodeDefinition).forEach((key) => {
            gcodeDefinition[key].default_value = gcodeConfig[key];
            // isGcodeConfig is true means to use updateGcodeConfig, false means to use updateToolConfig
            gcodeDefinition[key].isGcodeConfig = true;
        });
        const newSettings = {};
        Object.entries(cloneDeep(this.props.activeToolDefinition?.settings)).forEach(([key, value]) => {
            newSettings[toHump(key)] = value;
        });

        const allDefinition = {
            ...gcodeDefinition,
            ...newSettings
        };
        // Session First
        const toolDefinitionFirstKeys = [];
        if (isSVG || isImage || isSculpt && !isRotate && type !== TOOLPATH_TYPE_VECTOR) {
            toolDefinitionFirstKeys.push('targetDepth');
        }
        if (type !== TOOLPATH_TYPE_VECTOR || sliceMode === CNC_MESH_SLICE_MODE_ROTATION || sliceMode === CNC_MESH_SLICE_MODE_LINKAGE) {
            toolDefinitionFirstKeys.push('allowance');
        }
        const toolDefinitionFirst = {};
        toolDefinitionFirstKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionFirst[key] = allDefinition[key];
            }
        });

        // Session Tool
        const toolDefinitionToolKeys = (type === TOOLPATH_TYPE_VECTOR || isRotate) ? [
            'workSpeed', 'plungeSpeed', 'stepDown', 'stepOver'
        ] : ['workSpeed', 'plungeSpeed', 'stepDown', 'stepOver', 'toolExtensionEnabled'];
        const toolDefinitionTool = {};
        toolDefinitionToolKeys.forEach((key) => {
            if (allDefinition[key]) {
                toolDefinitionTool[key] = allDefinition[key];
            }
        });

        // Session Jog
        const toolDefinitionJogKeys = [
            'jogSpeed', 'safetyHeight', 'stopHeight'
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
                        <TipTrigger
                            title={i18n._('key-Cnc/ToolpathParameters-Name')}
                            content={i18n._('key-Cnc/ToolpathParameters-Enter the toolpath name.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('key-Cnc/ToolpathParameters-Name')}</span>
                                <TextInput
                                    className="sm-parameter-row__input"
                                    size="large"
                                    value={name}
                                    onChange={(event) => { this.props.updateToolPath({ name: event.target.value }); }}
                                />
                            </div>
                        </TipTrigger>
                        {multipleEngine && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('key-Cnc/ToolpathParameters-Use legacy engine')}</span>
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
                                    title={i18n._('key-Cnc/ToolpathParameters-method')}
                                    content={(
                                        <div>
                                            <p>{i18n._('key-Cnc/ToolpathParameters-Set the processing method of the object.')}</p>
                                            <ul>
                                                <li><b>{i18n._('key-Cnc/ToolpathParameters-On the Path')}</b>: {i18n._('key-Cnc/ToolpathParameters-Onthepath_Carves along the shape of the object.')}</li>
                                                <li><b>{i18n._('key-Cnc/ToolpathParameters-Outline')}</b>: {i18n._('key-Cnc/ToolpathParameters-Outline_Carves along the outline of the object.')}</li>
                                                <li><b>{i18n._('key-Cnc/ToolpathParameters-Fill')}</b>: {i18n._('key-Cnc/ToolpathParameters-Fill_Carves away the inner area of the object.')}</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <div>
                                        <span
                                            style={{ height: '30px', lineHeight: '30px' }}
                                        >
                                            {i18n._('key-Cnc/ToolpathParameters-Method')}
                                        </span>
                                        <Select
                                            disabled={false}
                                            size="large"
                                            className={classNames(
                                                'sm-parameter-row__select-md',
                                            )}
                                            clearable={false}
                                            name="carvePath"
                                            options={[
                                                {
                                                    label: i18n._('key-Cnc/ToolpathParameters-On the Path'),
                                                    value: 'path'
                                                },
                                                {
                                                    label: i18n._('key-Cnc/ToolpathParameters-Outline'),
                                                    value: 'outline'
                                                },
                                                {
                                                    label: i18n._('key-Cnc/ToolpathParameters-Fill'),
                                                    value: 'pocket'
                                                }
                                            ]}
                                            placeholder={i18n._('key-Cnc/ToolpathParameters-Methodtips_Choose carving path')}
                                            value={pathType}
                                            onChange={(option) => {
                                                const param = { pathType: option.value };
                                                if (option.value === 'pocket') {
                                                    param.enableTab = false;
                                                }
                                                this.props.updateGcodeConfig(param);
                                            }}
                                        />
                                    </div>
                                </TipTrigger>
                            </div>
                        )}
                        {isImage && (
                            <TipTrigger
                                title={i18n._('key-Cnc/ToolpathParameters-Method')}
                                content={i18n._('key-Cnc/ToolpathParameters-Set the processing method of the 2D object or 3D model.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('key-Cnc/ToolpathParameters-Method')}</span>
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
                                        title={i18n._('key-Cnc/ToolpathParameters-Method')}
                                        content={i18n._('key-Cnc/ToolpathParameters-Set the processing method of the 2D object or 3D model.')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('key-Cnc/ToolpathParameters-Method')}</span>
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
                                            title={i18n._('key-Cnc/ToolpathParameters-Method')}
                                            content={(
                                                <div>
                                                    <p>{i18n._('key-Cnc/ToolpathParameters-Set the processing method of the 3D model.')}</p>
                                                    <ul>
                                                        <li><b>{i18n._('key-Cnc/ToolpathParameters-Rotation')}</b>: {i18n._('key-Cnc/ToolpathParameters-The X axis is fixed during machining.')}</li>
                                                        <li><b>{i18n._('key-Cnc/ToolpathParameters-Linkage')}</b>: {i18n._('key-Cnc/ToolpathParameters-The X, Y, Z, and B axes will move during machining. Suitable for machining complicated models.')}</li>
                                                    </ul>
                                                </div>
                                            )}
                                        >
                                            <div className="sm-parameter-row">
                                                <span className="sm-parameter-row__label">{i18n._('key-Cnc/ToolpathParameters-Method')}</span>
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
                                {/*        <span>{i18n._('key-Cnc/ToolpathParameters-Y Smoothing')}</span>*/}
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
                        <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                                size={24}
                            />
                            <span>{i18n._('key-Cnc/ToolpathParameters-Tool')}</span>
                        </div>
                        <ToolSelector
                            toolDefinition={this.props.activeToolDefinition}
                            toolDefinitions={this.props.toolDefinitions}
                            setCurrentToolDefinition={this.props.setCurrentToolDefinition}
                            isModifiedDefinition={this.props.isModifiedDefinition}
                            setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                            isModel={isModel}
                        />
                        <ToolParameters
                            settings={toolDefinitionTool}
                            updateToolConfig={this.props.updateToolConfig}
                            updateGcodeConfig={this.props.updateGcodeConfig}
                            toolPath={this.props.toolPath}
                        />
                    </div>
                    <div>
                        <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                                type={['static']}
                            />
                            <span>{i18n._('key-Cnc/ToolpathParameters-Jog')}</span>
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
                            <div className="border-bottom-normal padding-bottom-4 margin-vertical-16">
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                <span>{i18n._('key-Cnc/ToolpathParameters-Tab')}</span>
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
