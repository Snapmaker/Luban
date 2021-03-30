import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Slider from 'rc-slider';
import Select from '../../../components/Select';
import { CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION, TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR } from '../../../constants';
import i18n from '../../../lib/i18n';
import { NumberInput as Input, TextInput } from '../../../components/Input';
import widgetStyles from '../../../widgets/styles.styl';
import ToolParameters from './ToolParameters';
import TipTrigger from '../../../components/TipTrigger';
import GcodeParameters from './GcodeParameters';

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

        materials: PropTypes.object.isRequired
    };

    state = {
        showToolFeed: true
    }

    actions = {
        onChangeShowToolFeed: (value) => {
            this.setState({
                showToolFeed: value
            });
        }
    };

    render() {
        const { toolPath, materials } = this.props;

        const { name, type, gcodeConfig } = toolPath;

        const { pathType, sliceMode, smoothY, fillDensity, allowance } = gcodeConfig;

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
                                        {i18n._('Path')}
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
                            {pathType === 'pocket' && (
                                <TipTrigger
                                    title={i18n._('Fill Density')}
                                    content={i18n._('Set the precision at which an area is carved. The highest density is 0.05 mm (20 dot/mm). When it is set to 0, the SVG image will be carved without fill.')}
                                >
                                    <div className="sm-parameter-row">
                                        <span className="sm-parameter-row__label">{i18n._('Fill Density')}</span>
                                        <Input
                                            className="sm-parameter-row__slider-input"
                                            value={fillDensity}
                                            min={1}
                                            max={20}
                                            style={{ width: '160px' }}
                                            onChange={(value) => { this.props.updateGcodeConfig({ fillDensity: value }); }}
                                        />
                                        <Slider
                                            className="sm-parameter-row__slider"
                                            value={fillDensity}
                                            min={1}
                                            max={20}
                                            onChange={(value) => { this.props.updateGcodeConfig({ fillDensity: value }); }}
                                        />
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

                            {isRotate && (
                                <React.Fragment>
                                    <TipTrigger
                                        title={i18n._('Slicing Mode')}
                                        content={i18n._('Select the slicing mode of the mesh tool path')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('Slicing Mode')}</span>
                                            <Select
                                                disabled={false}
                                                className="sm-parameter-row__select"
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
                                        style={{ width: '160px' }}
                                        onChange={() => { this.props.updateGcodeConfig({ smoothY: !smoothY }); }}
                                    />
                                </div>
                            )}
                        </div>
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
                <div className={classNames(widgetStyles.separator)} style={{ margin: '16px 0' }} />
                <div className="sm-tabs" style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': this.state.showToolFeed })}
                        onClick={() => {
                            this.actions.onChangeShowToolFeed(true);
                        }}
                    >
                        {i18n._('Tool & Feed')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%', borderRight: '1px solid #c8c8c8' }}
                        className={classNames('sm-tab', { 'sm-selected': !this.state.showToolFeed })}
                        onClick={() => {
                            this.actions.onChangeShowToolFeed(false);
                        }}
                    >
                        {i18n._('Height & Tabs')}
                    </button>
                </div>
                {this.state.showToolFeed && (
                    <ToolParameters
                        activeToolDefinition={this.props.activeToolDefinition}
                        toolDefinitions={this.props.toolDefinitions}
                        isModifiedDefinition={this.props.isModifiedDefinition}
                        updateToolConfig={this.props.updateToolConfig}
                        setCurrentValueAsProfile={this.props.setCurrentValueAsProfile}
                        toolPath={this.props.toolPath}
                    />
                )}
                {!this.state.showToolFeed && (
                    <GcodeParameters
                        toolPath={this.props.toolPath}
                        updateGcodeConfig={this.props.updateGcodeConfig}
                    />
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { materials } = state.cnc;
    return {
        materials
    };
};

export default connect(mapStateToProps, null)(CncParameters);
