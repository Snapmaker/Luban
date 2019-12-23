import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@trendmicro/react-buttons';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import { MACHINE_SERIES, MACHINE_HEAD_TYPE } from '../../constants';
import Modal from '../../components/Modal';
import { actions as machineActions } from '../../flux/machine';
import styles from '../CNCTool/styles.styl';
import Anchor from '../../components/Anchor';

class MachineSelection extends PureComponent {
    static propTypes = {
        series: PropTypes.string.isRequired,
        headType: PropTypes.string,

        display: PropTypes.bool.isRequired,
        closeModal: PropTypes.func.isRequired,

        executeGcode: PropTypes.func.isRequired,
        updateMachineState: PropTypes.func.isRequired
    };

    actions = {
        onChangeSeries: (v) => {
            this.props.updateMachineState({
                series: v.value
            });
        },
        onChangeHeadType: (v) => {
            this.props.updateMachineState({
                headType: v.value
            });
        },
        onClickClose: () => {
            if (this.props.series !== MACHINE_SERIES.ORIGINAL.value) {
                this.props.executeGcode('G54');
            }
            this.props.closeModal();
        }
    }

    render() {
        if (!this.props.display) {
            return null;
        }
        const state = this.props;
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
        const machineHeadTypeOptions = [
            {
                value: MACHINE_HEAD_TYPE['3DP'].value,
                label: MACHINE_HEAD_TYPE['3DP'].label,
                img: 'images/snap-logo-square-256x256.png'
            },
            {
                value: MACHINE_HEAD_TYPE.LASER.value,
                label: MACHINE_HEAD_TYPE.LASER.label,
                img: 'images/snap-logo-square-256x256.png'

            },
            {
                value: MACHINE_HEAD_TYPE.CNC.value,
                label: MACHINE_HEAD_TYPE.CNC.label,
                img: 'images/snap-logo-square-256x256.png'
            }
        ];


        return (
            <Modal disableOverlay size="md" onClose={this.actions.onClickCancel}>
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
                        { machineHeadTypeOptions.map(v => {
                            return (
                                <div key={v.value} className={styles['select-tool']}>
                                    <Anchor
                                        className={classNames(styles.selectToolBtn, { [styles.selected]: state.headType === v.value })}
                                        onClick={() => actions.onChangeHeadType(v)}
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
                        onClick={this.actions.onClickClose}
                    >
                        {i18n._('Cancel')}
                    </Button>
                    <Button
                        btnStyle="primary"
                        onClick={this.actions.onClickClose}
                    >
                        {i18n._('OK')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    const { series, headType } = state.machine;
    return {
        series,
        headType: headType
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context)),
        updateMachineState: (state) => dispatch(machineActions.updateMachineState(state))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(MachineSelection);
