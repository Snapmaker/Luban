import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import i18n from '../../../lib/i18n';
import { actions } from '../../../reducers/modules/machine';
import styles from '../form.styl';


class Enclosure extends PureComponent {
    static propTypes = {
        initialState: PropTypes.object,
        state: PropTypes.object,
        stateChanged: PropTypes.bool,
        actions: PropTypes.object,

        // redux
        enclosure: PropTypes.bool.isRequired,
        getEnclosureState: PropTypes.func.isRequired,
        setEnclosureState: PropTypes.func.isRequired
    };

    actions = {
        onChangeEnclosureState: (option) => {
            this.props.setEnclosureState(option.value);
        }
    };

    componentDidMount() {
        this.props.getEnclosureState();
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

        return (
            <div>
                <div className={styles['form-fields']}>
                    <div className={styles['form-group']}>
                        <label>{i18n._('Enclosure with door detection')}</label>
                        <div className={classNames(styles['form-control'], styles.short)}>
                            <Select
                                clearable={false}
                                searchable={false}
                                name={i18n._('Enclosure')}
                                options={options}
                                value={this.props.enclosure}
                                onChange={this.actions.onChangeEnclosureState}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        enclosure: state.machine.enclosure
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEnclosureState: () => dispatch(actions.getEnclosureState()),
        setEnclosureState: (on) => dispatch(actions.setEnclosureState(on))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Enclosure);
