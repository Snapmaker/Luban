import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import styles from './styles.styl';
import { PAGE_EDITOR, PAGE_PROCESS, SOURCE_TYPE_IMAGE3D } from '../../constants';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import TextParameters from '../CncLaserShared/TextParameters';
import TransformationSection from '../CncLaserShared/TransformationSection';
// import GcodeParameters from '../CncLaserShared/GcodeParameters';
import GcodeParametersForCnc from '../CncLaserShared/GcodeParametersForCnc';
import VectorParameters from './VectorParameters';
import Image3dParameters from './Image3dParameters';
import ImageProcessMode from './ImageProcessMode';
import ReliefGcodeParameters from './gcodeconfig/ReliefGcodeParameters';
import Image3DGcodeParameters from './gcodeconfig/Image3DGcodeParameters';
import { actions as editorActions } from '../../flux/editor';
import { actions as cncActions } from '../../flux/cnc';

class CNCPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        modelGroup: PropTypes.object,
        toolDefinitions: PropTypes.array.isRequired,
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        // transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        selectedModel: PropTypes.object,

        // functions
        setDisplay: PropTypes.func.isRequired,

        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,
        changeActiveToolListDefinition: PropTypes.func.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,

        // operator functions
        modifyText: PropTypes.func.isRequired,
        updateShowCncToolManager: PropTypes.func.isRequired
    };

    state = {
        activeToolListDefinition: null
    };

    actions = {
        onShowCncToolManager: () => {
            this.props.updateShowCncToolManager(true);
        },
        onChangeActiveToolListValue: (option) => {
            const definitionId = option.definitionId;
            const name = option.name;
            const activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const toolListDefinition = activeToolCategory.toolList.find(k => k.name === name);
            toolListDefinition.definitionId = definitionId;
            if (toolListDefinition) {
                this.setState({
                    activeToolListDefinition: toolListDefinition
                });
                this.props.changeActiveToolListDefinition(definitionId, name);
            }
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Configurations'));
    }

    componentDidMount() {
        const { modelGroup } = this.props;
        if (modelGroup.getSelectedModelArray().length > 0) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
    }

    componentWillReceiveProps(nextProps) {
        const { modelGroup } = nextProps;
        if (modelGroup.getSelectedModelArray().length > 0) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
        // Load 'toolDefinitions' and compose the content of the tool select
        if (nextProps.toolDefinitions !== this.props.toolDefinitions) {
            const newState = {};
            if (this.props.toolDefinitions.length === 0) {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === 'snap.v-bit');
                activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                Object.assign(newState, {
                    activeToolListDefinition
                });
            } else {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === this.state.activeToolListDefinition.definitionId) || nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === this.state.activeToolListDefinition.name)
                        || activeToolCategory.toolList.find(k => k.name === 'snap.v-bit');
                if (activeToolListDefinition) {
                    activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                    Object.assign(newState, {
                        activeToolListDefinition
                    });
                }
            }
            const toolDefinitionOptions = [];
            nextProps.toolDefinitions.forEach(d => {
                const category = d.category;
                const definitionId = d.definitionId;
                toolDefinitionOptions.push(...d.toolList.map((item) => {
                    const checkboxAndSelectGroup = {};
                    const name = item.name;
                    checkboxAndSelectGroup.name = name;
                    checkboxAndSelectGroup.definitionId = definitionId;
                    checkboxAndSelectGroup.label = `${category} - ${name}`;
                    checkboxAndSelectGroup.value = `${definitionId}-${name}`;
                    return checkboxAndSelectGroup;
                }));
            });
            Object.assign(newState, {
                toolDefinitionOptions: toolDefinitionOptions
            });
            this.setState(newState);
        }
    }

    render() {
        const {
            page, selectedModelArray,
            selectedModelVisible, sourceType, mode,
            showOrigin,
            updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config,
            changeSelectedModelShowOrigin, changeSelectedModelMode,
            updateSelectedModelUniformScalingState,
            selectedModel,
            modifyText,
            updateSelectedModelConfig
        } = this.props;
        const selectedNotHide = selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible;

        const isGreyscale = sourceType !== 'image3d' && mode === 'greyscale';
        const { toolDefinitionOptions, activeToolListDefinition } = this.state;
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (config.svgNodeName === 'text');
        const isImage3d = (sourceType === SOURCE_TYPE_IMAGE3D);
        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;
        const showImageProcessMode = (sourceType === 'raster' || sourceType === 'svg') && config.svgNodeName !== 'text';
        let methodType;
        if (isImage3d) {
            methodType = 'Carve';
        } else if (isSvgVector || isTextVector) {
            methodType = 'Contour';
        } else if (isGreyscale) {
            methodType = 'Carve';
        }
        return (
            <React.Fragment>
                {isEditor && (
                    <TransformationSection
                        headType="cnc"
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}
                    />
                )}
                {isProcess && (
                    <div>
                        <div className={classNames(
                            styles['material-select']
                        )}
                        >
                            <Select
                                clearable={false}
                                searchable
                                options={toolDefinitionOptions}
                                value={`${activeToolListDefinition.definitionId}-${activeToolListDefinition.name}`}
                                onChange={this.actions.onChangeActiveToolListValue}
                            />
                        </div>
                        <Anchor
                            onClick={this.actions.onShowCncToolManager}
                        >
                            <span
                                className={classNames(
                                    styles['manager-icon'],
                                )}
                            />
                        </Anchor>
                        <GcodeParametersForCnc
                            selectedModelArray={selectedModelArray}
                            selectedModelVisible={selectedModelVisible}
                            printOrder={printOrder}
                            gcodeConfig={gcodeConfig}
                            updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
                            updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                            paramsDescs={
                                {
                                    jogSpeed: i18n._('Determines how fast the tool moves when it’s not carving.'),
                                    workSpeed: i18n._('Determines how fast the tool feeds into the material.'),
                                    plungeSpeed: i18n._('Determines how fast the tool moves on the material.')
                                }
                            }
                        />
                    </div>
                )}
                {selectedModelArray.length === 1 && (
                    <div className="sm-parameter-container">
                        {isEditor && showImageProcessMode && (selectedModelArray.length === 1) && (
                            <ImageProcessMode
                                sourceType={sourceType}
                                mode={mode}
                                disabled={!selectedNotHide}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        {isEditor && isTextVector && (
                            <TextParameters
                                disabled={!selectedModelVisible}
                                config={config}
                                headType="cnc"
                                selectedModel={selectedModel}
                                modifyText={modifyText}
                            />
                        )}
                        {isEditor && isImage3d && (
                            <Image3dParameters
                                disabled={!selectedModelVisible}
                                config={config}
                                updateSelectedModelConfig={updateSelectedModelConfig}
                            />
                        )}
                        {isProcess && (isSvgVector) && (
                            <VectorParameters
                                methodType={methodType}
                                disabled={!selectedModelVisible}
                            />
                        )}
                        {isProcess && isGreyscale && !isImage3d && (
                            <ReliefGcodeParameters
                                methodType={methodType}
                                disabled={!selectedModelVisible}
                            />
                        )}
                        {isProcess && isImage3d && (
                            <Image3DGcodeParameters
                                methodType={methodType}
                                disabled={!selectedModelVisible}
                            />
                        )}
                    </div>
                )}
            </React.Fragment>
        );
    }
}

// todo, selected model will be instead
const mapStateToProps = (state) => {
    const { page, modelGroup, toolPathModelGroup, printOrder, toolDefinitions } = state.cnc;
    const selectedModel = modelGroup.getSelectedModel();
    const gcodeConfig = toolPathModelGroup.getSelectedModel().gcodeConfig;
    const selectedModelID = selectedModel.modelID;
    const {
        sourceType,
        mode,
        showOrigin,
        transformation,
        config
    } = selectedModel;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    return {
        selectedModelArray,
        page,
        printOrder,
        transformation,
        gcodeConfig,
        selectedModelID,
        selectedModel,
        toolDefinitions,
        // todo, next version fix like selectedModelID
        selectedModelVisible: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().visible,
        modelGroup,
        sourceType,
        mode,
        showOrigin,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeActiveToolListDefinition: (definitionId, name) => dispatch(cncActions.changeActiveToolListDefinition(definitionId, name)),
        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager)),
        updateSelectedModelTransformation: (params, changeFrom) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params, changeFrom)),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelConfig: (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('cnc', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('cnc', printOrder)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('cnc')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('cnc', sourceType, mode)),
        modifyText: (element, options) => dispatch(editorActions.modifyText('cnc', element, options))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
