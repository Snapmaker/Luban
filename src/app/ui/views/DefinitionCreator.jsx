import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { RadioButton, RadioGroup } from '../components/Radio';
import Select from '../components/Select';

import i18n from '../../lib/i18n';


class DefinitionCreator extends PureComponent {
    static propTypes = {
        isCreate: PropTypes.bool,
        disableCategory: PropTypes.bool,
        copyType: PropTypes.string,
        copyTargetName: PropTypes.string,
        materialOptions: PropTypes.array
    };

    static defaultProps = {
        disableCategory: true
    };

    state = {
        createType: 'Material',
        materialName: 'Default Material',
        toolName: 'Default Tool',
        materialDefinitionId: 'Default'
    }

    componentDidMount() {
        if (this.props.copyTargetName) {
            this.setState({
                materialName: this.props.copyTargetName,
                toolName: this.props.copyTargetName
            });
        }
    }

    getData() {
        return this.state;
    }

    renderMaterialCreate() {
        return (
            <div>
                <p>{i18n._('Enter Material Name:')}</p>
                <input
                    type="text"
                    style={{ height: '30px',
                        width: '100%',
                        padding: '6px 12px',
                        fontSize: '13px',
                        lineHeight: '1.42857143',
                        color: '#282828',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderRadius: '4px',
                        borderColor: '#c8c8c8' }}
                    onChange={(event) => {
                        const materialName = event.target.value;
                        this.setState({ materialName });
                    }}
                    value={this.state.materialName}
                />
            </div>
        );
    }

    renderToolCreate() {
        return (
            <div>
                {this.props.disableCategory && (
                    <div>
                        <p>{i18n._('Enter Profile Name:')}</p>
                        <input
                            type="text"
                            style={{ height: '30px',
                                width: '100%',
                                padding: '6px 12px',
                                fontSize: '13px',
                                lineHeight: '1.42857143',
                                color: '#282828',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '4px',
                                borderColor: '#c8c8c8' }}
                            onChange={(event) => {
                                const toolName = event.target.value;
                                this.setState({ toolName });
                            }}
                            value={this.state.toolName}
                        />
                    </div>
                )}
                {!this.props.disableCategory && (
                    <div>
                        <p>{i18n._('Enter Tool Name:')}</p>
                        <input
                            type="text"
                            style={{ height: '30px',
                                width: '100%',
                                padding: '6px 12px',
                                fontSize: '13px',
                                lineHeight: '1.42857143',
                                color: '#282828',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '4px',
                                borderColor: '#c8c8c8' }}
                            onChange={(event) => {
                                const toolName = event.target.value;
                                this.setState({ toolName });
                            }}
                            value={this.state.toolName}
                        />
                        <p style={{ marginTop: '10px' }}>
                            {i18n._('Select Tool Type:')}
                        </p>
                        <Select
                            backspaceRemoves={false}
                            clearable={false}
                            options={this.props.materialOptions}
                            placeholder={i18n._('Choose font')}
                            value={this.state.materialDefinitionId}
                            onChange={(option) => {
                                const materialDefinitionId = option.value;
                                this.setState({ materialDefinitionId });
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }


    render() {
        const { isCreate } = this.props;
        if (isCreate) {
            return (
                <RadioGroup
                    name="comic"
                    value={this.state.createType}
                    onChange={(event) => {
                        const value = event.target.value;
                        this.setState({ createType: value });
                    }}
                >
                    <div>
                        <RadioButton value="Material">{i18n._('Create Material')}</RadioButton>
                        {this.state.createType === 'Material' && this.renderMaterialCreate()}
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <RadioButton value="Tool">{i18n._('Create Carving Tool')}</RadioButton>
                        {this.state.createType === 'Tool' && this.renderToolCreate()}
                    </div>

                </RadioGroup>
            );
        } else {
            if (this.props.copyType === 'Material') {
                return this.renderMaterialCreate();
            } else {
                return this.renderToolCreate();
            }
        }
    }
}

export default DefinitionCreator;
