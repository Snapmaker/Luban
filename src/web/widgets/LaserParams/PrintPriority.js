import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions } from '../../reducers/modules/laser';


class PrintPriority extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        changePrintPriority: PropTypes.func.isRequired
    };

    actions = {
        onChangePrintPriority: (printPriority) => {
            this.props.changePrintPriority(printPriority);
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const { printPriority } = this.props;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Print Priority')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Print Priority')}
                                    content={i18n._('Set the print Priority of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={printPriority}
                                                min={1}
                                                max={10}
                                                onChange={actions.onChangePrintPriority}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={printPriority}
                                            min={1}
                                            max={10}
                                            onChange={actions.onChangePrintPriority}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { model, printPriority } = state.laser;
    return {
        model: model,
        printPriority: printPriority
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changePrintPriority: (value) => dispatch(actions.changePrintPriority(value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintPriority);

