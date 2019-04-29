import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import isEqual from 'lodash/isEqual';
import { NumberInput } from '../../../components/Input';
import i18n from '../../../lib/i18n';
import { actions } from '../../../reducers/machine';
import styles from '../form.styl';


class MachineSettings extends PureComponent {
    static propTypes = {
        initialState: PropTypes.object,
        state: PropTypes.object,
        stateChanged: PropTypes.bool,
        actions: PropTypes.object,

        // redux
        machineSetting: PropTypes.object.isRequired,
        enclosure: PropTypes.bool.isRequired,
        updateMachineSetting: PropTypes.func.isRequired,
        getEnclosureState: PropTypes.func.isRequired,
        setEnclosureState: PropTypes.func.isRequired
    };

    state = {
        enclosure: false,
        customSettingEnabled: true,
        customSizeChanged: false,
        machineTypeOptions: [
            {
                value: 'original',
                label: i18n._('Snapmaker Original')
            },
            {
                value: 'A150',
                label: i18n._('Snapmaker2 A150')
            },
            {
                value: 'A250',
                label: i18n._('Snapmaker2 A250')
            },
            {
                value: 'A350',
                label: i18n._('Snapmaker2 A350')
            },
            {
                value: 'custom',
                label: i18n._('Custom')
            }
        ],
        machineSetting: {
            type: '',
            size: {
                x: 0,
                y: 0,
                z: 0
            }
        },
        customSize: {
            x: 0,
            y: 0,
            z: 0
        }
    };

    actions = {
        onChangeMachineType: (machineTypeOption) => {
            this.setState({
                machineSetting: {
                    ...this.state.machineSetting,
                    type: machineTypeOption.value
                }
            });
            const size = {
                original: {
                    x: 125,
                    y: 125,
                    z: 125
                },
                A150: {
                    x: 160,
                    y: 160,
                    z: 145
                },
                A250: {
                    x: 230,
                    y: 250,
                    z: 240
                },
                A350: {
                    x: 320,
                    y: 340,
                    z: 330
                }
            };
            switch (machineTypeOption.value) {
                case 'original':
                    this.setState({
                        machineSetting: {
                            type: 'original',
                            size: size.original
                        },
                        customSettingEnabled: false
                    });
                    break;
                case 'A150':
                    this.setState({
                        machineSetting: {
                            type: 'A150',
                            size: size.A150
                        },
                        customSettingEnabled: false
                    });
                    break;
                case 'A250':
                    this.setState({
                        machineSetting: {
                            type: 'A250',
                            size: size.A250
                        },
                        customSettingEnabled: false
                    });
                    break;
                case 'A350':
                    this.setState({
                        machineSetting: {
                            type: 'A350',
                            size: size.A350
                        },
                        customSettingEnabled: false
                    });
                    break;
                case 'custom':
                    this.setState({
                        machineSetting: {
                            type: 'custom',
                            size: this.state.customSize
                        },
                        customSettingEnabled: true
                    });
                    break;
                default:
                    break;
            }
        },
        onChangeEnclosureState: (option) => {
            this.setState({
                enclosure: option.value
            });
        },
        onChangeSizeX: (value) => {
            if (this.state.customSize.x !== value) {
                this.setState({
                    customSizeChanged: true,
                    customSize: {
                        ...this.state.customSize,
                        x: value
                    }
                });
            }
            this.setState({
                machineSetting: {
                    type: 'custom',
                    size: this.state.customSize
                }
            });
        },
        onChangeSizeY: (value) => {
            if (this.state.customSize.y !== value) {
                this.setState({
                    customSizeChanged: true,
                    customSize: {
                        ...this.state.customSize,
                        y: value
                    },
                });
            }
            this.setState({
                machineSetting: {
                    type: 'custom',
                    size: this.state.customSize
                }
            });
        },
        onChangeSizeZ: (value) => {
            if (this.state.customSize.z !== value) {
                this.setState({
                    customSizeChanged: true,
                    customSize: {
                        ...this.state.customSize,
                        z: value
                    }
                });
            }
            this.setState({
                machineSetting: {
                    type: 'custom',
                    size: this.state.customSize
                }
            });
        },
        onCancel: () => {
            this.setState({
                enclosure: this.props.enclosure,
                customSizeChanged: false,
                machineSetting: this.props.machineSetting
            });
        },
        onSave: () => {
            this.setState({
                customSizeChanged: false
            });
            this.props.setEnclosureState(this.state.enclosure);
            this.props.updateMachineSetting(this.state.machineSetting);
        }
    };

    constructor(props) {
        super(props);

        this.state.machineSetting = props.machineSetting;
        this.state.customSize = props.machineSetting.size;
    }

    componentDidMount() {
        this.props.getEnclosureState();
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.enclosure, this.state.enclosure)) {
            this.setState({ enclosure: nextProps.enclosure });
        }

        if (!isEqual(nextProps.machineSetting, this.state.machineSetting)) {
            this.setState({ machineSetting: nextProps.machineSetting });
        }
    }

    render() {
        const options = [
            {
                value: true,
                label: i18n._('On')
            },
            {
                value: false,
                label: i18n._('Off')
            }
        ];
        const machineTypeOptions = this.state.machineTypeOptions;
        const machineSetting = this.state.machineSetting;
        const customSettingEnabled = this.state.customSettingEnabled;

        const stateChanged = this.state.customSizeChanged ||
            !isEqual(this.props.machineSetting, this.state.machineSetting) ||
            !isEqual(this.props.enclosure, this.state.enclosure);


        return (
            <div className={styles['form-container']} style={{ marginBottom: '55px' }}>
                <p className={styles['form-title']}>{i18n._('Machine')}</p>
                <div className={styles['form-group']}>
                    <label>{i18n._('Machine Type')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <Select
                            clearable={false}
                            searchable={false}
                            name={i18n._('Machine Type')}
                            options={machineTypeOptions}
                            value={machineSetting.type}
                            onChange={this.actions.onChangeMachineType}
                        />
                    </div>
                </div>
                <div className={styles['form-group']}>
                    <label>{i18n._('X (Width)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={machineSetting.size.x}
                            disabled={!customSettingEnabled}
                            onChange={this.actions.onChangeSizeX}
                        />
                        <span className={styles.unit}>mm</span>
                    </div>
                </div>
                <div className={styles['form-group']}>
                    <label>{i18n._('Y (Depth)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={machineSetting.size.y}
                            disabled={!customSettingEnabled}
                            onChange={this.actions.onChangeSizeY}
                        />
                        <span className={styles.unit}>mm</span>
                    </div>
                </div>
                <div className={styles['form-group']}>
                    <label>{i18n._('Z (Height)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={machineSetting.size.z}
                            disabled={!customSettingEnabled}
                            onChange={this.actions.onChangeSizeZ}
                        />
                        <span className={styles.unit}>mm</span>
                    </div>
                </div>
                <p className={styles['form-title']}>{i18n._('Enclosure')}</p>
                <div className={styles['form-group']}>
                    <label>{i18n._('Door detection')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <Select
                            clearable={false}
                            searchable={false}
                            name={i18n._('Door detection')}
                            options={options}
                            value={this.state.enclosure}
                            onChange={this.actions.onChangeEnclosureState}
                        />
                    </div>
                </div>
                <div className={styles['form-actions']}>
                    <div className="row">
                        <div className="col-md-12">
                            <button
                                type="button"
                                className="btn btn-default"
                                onClick={this.actions.onCancel}
                            >
                                {i18n._('Cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!stateChanged}
                                onClick={this.actions.onSave}
                            >
                                <i className="fa fa-save" />
                                <span className="space" />
                                {i18n._('Save Changes')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    return {
        machineSetting: machine.machineSetting,
        enclosure: machine.enclosure
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEnclosureState: () => dispatch(actions.getEnclosureState()),
        setEnclosureState: (on) => dispatch(actions.setEnclosureState(on)),
        updateMachineSetting: (setting) => dispatch(actions.updateMachineSetting(setting))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(MachineSettings);
