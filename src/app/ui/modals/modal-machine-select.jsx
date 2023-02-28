/* eslint react/no-set-state: 0 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { Button } from '../components/Buttons';
import i18n from '../../lib/i18n';
import Modal from '../components/Modal';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, MACHINE_HEAD_TYPE } from '../../constants';
import {
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES,
} from '../../constants/machines';
import Anchor from '../components/Anchor';
import styles from './styles.styl';

class MachineSelectModal extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        series: PropTypes.string,
        headType: PropTypes.string,

        hasHead: PropTypes.bool,
        onConfirm: PropTypes.func
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        series: this.props.series || MACHINE_SERIES.ORIGINAL.identifier,
        headType: this.props.headType || HEAD_PRINTING,
        toolHead: ''
    };

    actions = {
        onChangeSeries: (v) => {
            this.setState({
                series: v.value
            });
        },
        onChangeHeadType: (v) => {
            this.setState({
                headType: v.headType,
                toolHead: v.toolHead
            });
        }
    };

    handleClose = () => {
        setTimeout(() => {
            this.removeContainer();
        });
    };

    handleConfirm = () => {
        setTimeout(() => {
            this.removeContainer();
            this.props.onConfirm && this.props.onConfirm(this.state.series, this.state.headType, this.state.toolHead);
        });
    };

    removeContainer() {
        const { container } = this.props;
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const machineSeriesOptions = [
            {
                value: MACHINE_SERIES.ORIGINAL.identifier,
                label: i18n._(MACHINE_SERIES.ORIGINAL.label),
                img: '/resources/images/machine/size-1.0-original2.jpg'
            },
            {
                value: MACHINE_SERIES.A150.identifier,
                label: i18n._(MACHINE_SERIES.A150.label),
                img: '/resources/images/machine/size-2.0-A1502.jpg'
            },
            {
                value: MACHINE_SERIES.A250.identifier,
                label: i18n._(MACHINE_SERIES.A250.label),
                img: '/resources/images/machine/size-2.0-A2502.jpg'
            },
            {
                value: MACHINE_SERIES.A350.identifier,
                label: i18n._(MACHINE_SERIES.A350.label),
                img: '/resources/images/machine/size-2.0-A3502.jpg'
            },
            {
                value: MACHINE_SERIES.A400.identifier,
                label: i18n._(MACHINE_SERIES.A400.label),
                img: '/resources/images/machine/size-2.0-A3502.jpg'
            }
        ];
        const machineHeadTypeOptions = [
            {
                value: HEAD_PRINTING,
                headType: HEAD_PRINTING,
                label: i18n._(MACHINE_HEAD_TYPE['3DP'].label),
                img: '/resources/images/machine/function-3d-printing.jpg'
            },
            {
                value: HEAD_LASER,
                headType: HEAD_LASER,
                toolHead: LEVEL_ONE_POWER_LASER_FOR_SM2,
                label: i18n._(MACHINE_HEAD_TYPE.LASER.label),
                img: '/resources/images/machine/function-laser.jpg'

            },
            {
                value: '10W-LASER',
                headType: HEAD_LASER,
                toolHead: LEVEL_TWO_POWER_LASER_FOR_SM2,
                label: i18n._(MACHINE_HEAD_TYPE['10W LASER'].label),
                img: '/resources/images/machine/function-laser-10w.jpg'
            },
            {
                value: HEAD_CNC,
                headType: HEAD_CNC,
                label: i18n._(MACHINE_HEAD_TYPE.CNC.label),
                img: '/resources/images/machine/function-cnc.jpg'
            }
        ];
        return (
            <Modal disableOverlay closable={false} size="md" onClose={this.handleClose}>
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key-Workspace/MachineSelectModal-Device Not Recognized')}
                    {/* </Modal.Title> */}
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['which-model']}>{i18n._('key-Workspace/MachineSelectModal-Select the machine model that is connected to Luban')}
                    </div>
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
                    {this.props.hasHead !== false && (
                        <div>
                            <div className={classNames(styles.separator, styles['separator-underline'])} />
                            <div className={styles['which-toolhead']}>{i18n._('key-Workspace/MachineSelectModal-Which toolhead is attached to your Snapmaker Luban?')}</div>
                            <div className={styles['select-tools']}>
                                { machineHeadTypeOptions.map(v => {
                                    // TODO
                                    if ((state.series === MACHINE_SERIES.A150.identifier || state.series === MACHINE_SERIES.ORIGINAL.identifier)
                                        && v.toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                                        return null;
                                    }
                                    return (
                                        <div key={v.value} className={styles['select-tool']}>
                                            <Anchor
                                                className={classNames(styles.selectToolBtn, { [styles.selected]: (state.headType === v.headType && state.toolHead === v.toolHead) })}
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
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        priority="level-two"
                        width="96px"
                        onClick={this.handleConfirm}
                    >
                        {i18n._('key-Workspace/MachineSelectModal-Select')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default (options) => new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const props = {
        ...options,
        onClose: () => {
            resolve();
        },
        container: container
    };

    ReactDOM.render(<MachineSelectModal {...props} />, container);
});
