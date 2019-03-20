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
        size: PropTypes.object.isRequired,
        updateMachineSize: PropTypes.func.isRequired,
        enclosure: PropTypes.bool.isRequired,
        getEnclosureState: PropTypes.func.isRequired,
        setEnclosureState: PropTypes.func.isRequired
    };

    state = {
        enclosure: false,
        size: {
            x: 0,
            y: 0,
            z: 0
        }
    };

    actions = {
        onChangeEnclosureState: (option) => {
        },
        onChangeSizeX: (value) => {
            this.setState({
                size: {
                    ...this.state.size,
                    x: value
                }
            });
        },
        onChangeSizeY: (value) => {
            this.setState({
                size: {
                    ...this.state.size,
                    y: value
                }
            });
        },
        onChangeSizeZ: (value) => {
            this.setState({
                size: {
                    ...this.state.size,
                    z: value
                }
            });
        },
        onCancel: () => {
            this.setState({
                enclosure: this.props.enclosure,
                size: this.props.size
            });
        },
        onSave: () => {
            this.props.setEnclosureState(this.state.enclosure);

            this.props.updateMachineSize(this.state.size);
        }
    };

    constructor(props) {
        super(props);

        this.state.size = props.size;
    }

    componentDidMount() {
        this.props.getEnclosureState();
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.enclosure, this.state.enclosure)) {
            this.setState({ enclosure: nextProps.enclosure });
        }

        if (!isEqual(nextProps.size, this.state.size)) {
            this.setState({ size: nextProps.size });
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

        const stateChanged = !isEqual(this.props.enclosure, this.state.enclosure)
            || !isEqual(this.props.size, this.state.size);

        return (
            <div className={styles['form-container']} style={{ marginBottom: '55px' }}>
                <p className={styles['form-title']}>{i18n._('Machine')}</p>
                <div className={styles['form-group']}>
                    <label>{i18n._('X (Width)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={this.state.size.x}
                            onChange={this.actions.onChangeSizeX}
                        />
                        <span className={styles.unit}>mm</span>
                    </div>
                </div>
                <div className={styles['form-group']}>
                    <label>{i18n._('Y (Depth)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={this.state.size.y}
                            onChange={this.actions.onChangeSizeY}
                        />
                        <span className={styles.unit}>mm</span>
                    </div>
                </div>
                <div className={styles['form-group']}>
                    <label>{i18n._('Z (Height)')}</label>
                    <div className={classNames(styles['form-control'], styles.short)}>
                        <NumberInput
                            value={this.state.size.z}
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
        size: machine.size,
        enclosure: machine.enclosure
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEnclosureState: () => dispatch(actions.getEnclosureState()),
        setEnclosureState: (on) => dispatch(actions.setEnclosureState(on)),
        updateMachineSize: (size) => dispatch(actions.updateMachineSize(size))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(MachineSettings);
