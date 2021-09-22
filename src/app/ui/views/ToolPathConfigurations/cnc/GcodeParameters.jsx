import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import OptionalDropdown from '../../../components/OptionalDropdown';

class GcodeParameters extends PureComponent {
    static propTypes = {
        toolPath: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired,

        updateGcodeConfig: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    render() {
        const { toolPath, materials, size } = this.props;

        const { type, gcodeConfig } = toolPath;

        const { pathType, enableTab, tabHeight, tabSpace, tabWidth } = gcodeConfig;
        const { targetDepth, safetyHeight, stopHeight } = gcodeConfig;

        const { isRotate } = materials;

        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isSculpt = type === TOOLPATH_TYPE_SCULPT;

        return (
            <React.Fragment>
                <div className="sm-parameter-container">
                    {!(isSculpt && isRotate) && (
                        <TipTrigger
                            title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Target Depth')}
                            content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Set the depth of the object to be carved. The depth should be smaller than the flute length.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Target Depth')}</span>
                                <Input
                                    disabled={false}
                                    className="sm-parameter-row__input"
                                    size="small"
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
                    <TipTrigger
                        title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Jog Height')}
                        content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Set the distance between the tool and the material when the tool is not carving.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Jog Height')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                size="small"
                                value={safetyHeight}
                                min={0.1}
                                max={size.z}
                                step={1}
                                onChange={(value) => { this.props.updateGcodeConfig({ safetyHeight: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Stop Height')}
                        content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_The distance between the bit and the material when the machine stops.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Stop Height')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                size="small"
                                value={stopHeight}
                                min={0.1}
                                max={size.z}
                                step={1}
                                onChange={(value) => { this.props.updateGcodeConfig({ stopHeight: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </TipTrigger>
                    {isSVG && (
                        <div>
                            {(pathType === 'path' || pathType === 'outline') && (
                                <OptionalDropdown
                                    style={{ marginBottom: '10px' }}
                                    title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tabs')}
                                    onClick={() => { this.props.updateGcodeConfig({ enableTab: !enableTab }); }}
                                    hidden={!enableTab}
                                >
                                    <TipTrigger
                                        title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Height')}
                                        content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Enter the height of the tabs.')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Height')}</span>
                                            <Input
                                                className="sm-parameter-row__input"
                                                value={tabHeight}
                                                min={0}
                                                max={targetDepth}
                                                step={0.1}
                                                onChange={(value) => { this.props.updateGcodeConfig({ tabHeight: value }); }}
                                                disabled={!enableTab}
                                            />
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                    </TipTrigger>
                                    <TipTrigger
                                        title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Space')}
                                        content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Enter the space between any two tabs.')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Space')}</span>
                                            <Input
                                                className="sm-parameter-row__input"
                                                value={tabSpace}
                                                min={1}
                                                step={1}
                                                onChange={(value) => { this.props.updateGcodeConfig({ tabSpace: value }); }}
                                                disabled={!enableTab}
                                            />
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                    </TipTrigger>
                                    <TipTrigger
                                        title={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Width')}
                                        content={i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Enter the width of the tabs.')}
                                    >
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label">{i18n._('key_ui/views/ToolPathConfigurations/cnc/GcodeParameters_Tab Width')}</span>
                                            <Input
                                                className="sm-parameter-row__input"
                                                style={{ width: '160px' }}
                                                value={tabWidth}
                                                min={1}
                                                step={1}
                                                onChange={(value) => { this.props.updateGcodeConfig({ tabWidth: value }); }}
                                                disabled={!enableTab}
                                            />
                                            <span className="sm-parameter-row__input-unit">mm</span>
                                        </div>
                                    </TipTrigger>
                                </OptionalDropdown>
                            )}
                        </div>
                    )}
                </div>
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

export default connect(mapStateToProps, null)(GcodeParameters);
