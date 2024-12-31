import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { includes } from 'lodash';
import { connect } from 'react-redux';

import { Col, Divider, Form, InputNumber, Row } from 'antd';
import MaterialTestGcodeParams from './MaterialTestGcodeParams';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';
import formStyles from './FormStyles.styl';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';

class MaterialTestParameters extends PureComponent {
    static propTypes = {
        toolDefinitions: PropTypes.array.isRequired,
        activeToolDefinition: PropTypes.object.isRequired,
        isModifiedDefinition: PropTypes.bool.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        setCurrentToolDefinition: PropTypes.func.isRequired,
        updateGcodeConfig: PropTypes.func.isRequired,
        updateToolConfig: PropTypes.func.isRequired,
        setCurrentValueAsProfile: PropTypes.func.isRequired,
        form: PropTypes.object.isRequired,
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
                    movementMode: options.value
                });
            } else if (options.value === 'greyscale-dot') {
                this.props.updateGcodeConfig({
                    dwellTime: 42,
                    jogSpeed: 1500,
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
            }
            if (option.movementMode === 'greyscale-line') {
                option.direction = (!this.props.materials?.isRotate ? 'Horizontal' : 'Vertical');
                option.fillInterval = 0.25;
                option.jogSpeed = 3000;
            }

            // Fill Enabled
            if (option.pathType === true) {
                option.fillInterval = 0.25;
                option.jogSpeed = 3000;
                option.multiPasses = 1;
            }
            if (option.pathType === false) {
                option.jogSpeed = 3000;
                option.multiPasses = 2;
                option.multiPassDepth = 0.6;
            }

            // Fiexd Power Enabled
            option.fixedPowerEnabled = true;
            this.props.updateGcodeConfig(option);
        }
    };

    render() {
        const { activeMachine, toolHeadIdentifier, form } = this.props;

        const speedFormItems = [
            { name: 'rectRows', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-rowCount'), component: <InputNumber className={formStyles.input} min={1} max={11} name="rectRows" /> },
            {
                name: 'speedMin',
                suffix: 'mm/min',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
                component: <InputNumber controls={false} className={formStyles.input} min={1} name="speedMin" />
            },
            {
                name: 'speedMax',
                suffix: 'mm/min',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
                component: <InputNumber controls={false} className={formStyles.input} min={200} max={30000} name="speedMax" />
            },
            {
                name: 'rectHeight',
                suffix: 'mm',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-height'),
                component: <InputNumber controls={false} className={formStyles.input} min={2} max={12} name="rectHeight" />
            },
        ];
        const powerFormItems = [
            { name: 'rectCols', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-columnCount'), component: <InputNumber className={formStyles.input} min={1} max={11} name="rectCols" /> },
            {
                name: 'powerMin',
                suffix: '%',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
                component: <InputNumber controls={false} className={formStyles.input} max={100} min={0} name="powerMin" />
            },
            {
                name: 'powerMax',
                suffix: '%',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
                component: <InputNumber controls={false} className={formStyles.input} max={100} min={1} name="powerMax" />
            },
            {
                name: 'rectWidth',
                suffix: 'mm',
                label: i18n._('key_ui-views-MaterialTestModal-FormComponent-width'),
                component: <InputNumber controls={false} className={formStyles.input} min={2} max={12} name="rectWidth" />
            },
        ];
        const zOffsetEnabled = activeMachine.metadata.size.z > 0;
        const halfDiodeModeEnabled = includes([L40WLaserToolModule.identifier], toolHeadIdentifier);
        const auxiliaryAirPumpEnabled = includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolHeadIdentifier);
        return (
            <React.Fragment>
                <div className="border-default-grey-1 border-radius-8 padding-vertical-8 padding-horizontal-16">
                    <Form id="formIDataBox" form={form} labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
                        <Row gutter={24}>
                            <Col span={12}>
                                <div className={formStyles['title-box']}>
                                    <div>
                                        <SvgIcon
                                            name="TitleSetting"
                                            type={['static']}
                                            size={24}
                                        />
                                        {i18n._('key_ui-views-MaterialTestModal-FormComponent-rows')}
                                    </div>
                                    <div className={formStyles['title-box-name']}>{i18n._('key_ui-views-MaterialTestModal-FormComponent-speed')}</div>
                                </div>
                                <Divider className={formStyles.divider} />
                                {speedFormItems.map((item) => (
                                    <div className={formStyles['input-box']} key={item.name}>
                                        <Form.Item name={item.name} key={item.label} label={<span className={formStyles['input-label']}>{item.label}</span>} colon={false} className={formStyles['form-item']}>
                                            {item.component}
                                        </Form.Item>
                                        <div className={formStyles['input-suffix']}>{item.suffix}</div>
                                    </div>
                                ))}
                            </Col>
                            <Col span={12}>
                                <div className={formStyles['title-box']}>
                                    <div>
                                        <SvgIcon
                                            name="TitleSetting"
                                            type={['static']}
                                            size={24}
                                        />
                                        {i18n._('key_ui-views-MaterialTestModal-FormComponent-columns')}
                                    </div>
                                    <div className={formStyles['title-box-name']}>{i18n._('key_ui-views-MaterialTestModal-FormComponent-power')}</div>
                                </div>
                                <Divider className={formStyles.divider} />
                                {powerFormItems.map((item) => (
                                    <div className={formStyles['input-box']} key={item.name}>
                                        <Form.Item name={item.name} key={item.label} label={<span className={formStyles['input-label']}>{item.label}</span>} colon={false} className={formStyles['form-item']}>
                                            {item.component}
                                        </Form.Item>
                                        <div className={formStyles['input-suffix']}>{item.suffix}</div>
                                    </div>
                                ))}
                            </Col>
                        </Row>
                    </Form>
                    <MaterialTestGcodeParams
                        gcodeConfig={this.props.gcodeConfig}
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

export default connect(mapStateToProps, null)(MaterialTestParameters);
