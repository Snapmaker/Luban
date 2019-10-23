import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@trendmicro/react-buttons';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import { MACHINE_SERIES, MACHINE_PATTERN } from '../../constants';
import Modal from '../../components/Modal';
import { actions as machineActions } from '../../flux/machine';
import styles from '../CNCTool/styles.styl';
import Anchor from '../../components/Anchor';

class MachineSelection extends PureComponent {
    static propTypes = {
        series: PropTypes.string.isRequired,
        pattern: PropTypes.string.isRequired,

        closeModal: PropTypes.func.isRequired,

        updateMachinePattern: PropTypes.func.isRequired,
        updateMachineSeries: PropTypes.func.isRequired
    };

    state = {
        series: this.props.series,
        pattern: this.props.pattern
    }

    actions = {
        onChangeSeries: (v) => {
            this.setState(
                { series: v.value }
            );
        },
        onChangePattern: (v) => {
            this.setState(
                { pattern: v.value }
            );
        },
        onClickOk: () => {
            this.props.updateMachinePattern(this.state.pattern);
            this.props.updateMachineSeries(this.state.series);
            this.props.closeModal();
        },
        onClickCancel: () => {
            this.props.closeModal();
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const machineSeriesOptions = [
            {
                value: MACHINE_SERIES.ORIGINAL.value,
                label: MACHINE_SERIES.ORIGINAL.label,
                img: 'images/snap-logo-square-256x256.png'
            },
            {
                value: MACHINE_SERIES.A150.value,
                label: MACHINE_SERIES.A150.label,
                img: 'images/snap-logo-square-256x256.png'
            },
            {
                value: MACHINE_SERIES.A250.value,
                label: MACHINE_SERIES.A250.label,
                img: 'images/snap-logo-square-256x256.png'
            },
            {
                value: MACHINE_SERIES.A350.value,
                label: MACHINE_SERIES.A350.label,
                img: 'images/snap-logo-square-256x256.png'
            }
        ];
        const machinePatternOptions = [
            {
                value: MACHINE_PATTERN['3DP'].value,
                label: MACHINE_PATTERN['3DP'].label,
                img: 'images/snap-logo-square-256x256.png'
            },
            {
                value: MACHINE_PATTERN.LASER.value,
                label: MACHINE_PATTERN.LASER.label,
                img: 'images/snap-logo-square-256x256.png'

            },
            {
                value: MACHINE_PATTERN.CNC.value,
                label: MACHINE_PATTERN.CNC.label,
                img: 'images/snap-logo-square-256x256.png'
            }
        ];

        return (
            <Modal disableOverlay size="md" onClose={this.props.closeModal}>
                <Modal.Header>
                    <Modal.Title>
                        {i18n._('Machine Select')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['select-tools']}>
                        { machineSeriesOptions.map(v => {
                            return (
                                <div key={v.value} className={styles['select-tool']}>
                                    <Anchor
                                        className={classNames(styles.selectToolBtn, { [styles.selected]: state.series === v.value })}
                                        onClick={() => actions.onChangeSeries(v)}
                                    >
                                        <img
                                            src={v.img}
                                            role="presentation"
                                            alt="V-Bit"
                                        />
                                    </Anchor>
                                    <span className={styles.selectToolText}>{i18n._(v.label)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className={styles['select-tools']}>
                        { machinePatternOptions.map(v => {
                            return (
                                <div key={v.value} className={styles['select-tool']}>
                                    <Anchor
                                        className={classNames(styles.selectToolBtn, { [styles.selected]: state.pattern === v.value })}
                                        onClick={() => actions.onChangePattern(v)}
                                    >
                                        <img
                                            src={v.img}
                                            role="presentation"
                                            alt="V-Bit"
                                        />
                                    </Anchor>
                                    <span className={styles.selectToolText}>{i18n._(v.label)}</span>
                                </div>
                            );
                        })}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={this.actions.onClickCancel}
                    >
                        {i18n._('Cancel')}
                    </Button>
                    <Button
                        btnStyle="primary"
                        onClick={this.actions.onClickOk}
                    >
                        {i18n._('OK')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
const mapStateToProps = (state) => {
    const { series, pattern } = state.machine;
    return {
        series: series,
        pattern: pattern
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        updateMachinePattern: (pattern) => dispatch(machineActions.updateMachinePattern(pattern)),
        updateMachineSeries: (series) => dispatch(machineActions.updateMachineSeries(series))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(MachineSelection);
