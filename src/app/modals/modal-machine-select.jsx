/* eslint react/no-set-state: 0 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { Button } from '@trendmicro/react-buttons';
import i18n from '../lib/i18n';
import Modal from '../components/Modal';
import { MACHINE_HEAD_TYPE, MACHINE_SERIES } from '../constants';
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
        series: this.props.series || MACHINE_SERIES.ORIGINAL.value,
        headType: this.props.headType || MACHINE_HEAD_TYPE['3DP'].value
    };

    actions = {
        onChangeSeries: (v) => {
            this.setState({
                series: v.value
            });
        },
        onChangeHeadType: (v) => {
            this.setState({
                headType: v.value
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
            this.props.onConfirm && this.props.onConfirm(this.state.series, this.state.headType);
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
                value: MACHINE_SERIES.ORIGINAL.value,
                label: MACHINE_SERIES.ORIGINAL.label,
                img: 'images/machine/size-1.0-original.jpg'
            },
            {
                value: MACHINE_SERIES.A150.value,
                label: MACHINE_SERIES.A150.label,
                img: 'images/machine/size-2.0-A150.jpg'
            },
            {
                value: MACHINE_SERIES.A250.value,
                label: MACHINE_SERIES.A250.label,
                img: 'images/machine/size-2.0-A250.jpg'
            },
            {
                value: MACHINE_SERIES.A350.value,
                label: MACHINE_SERIES.A350.label,
                img: 'images/machine/size-2.0-A350.jpg'
            }
        ];
        const machineHeadTypeOptions = [
            {
                value: MACHINE_HEAD_TYPE['3DP'].value,
                label: MACHINE_HEAD_TYPE['3DP'].label,
                img: 'images/machine/function-3d-printing.jpg'
            },
            {
                value: MACHINE_HEAD_TYPE.LASER.value,
                label: MACHINE_HEAD_TYPE.LASER.label,
                img: 'images/machine/function-laser.jpg'

            },
            {
                value: MACHINE_HEAD_TYPE.CNC.value,
                label: MACHINE_HEAD_TYPE.CNC.label,
                img: 'images/machine/function-cnc.jpg'
            }
        ];

        return (
            <Modal disableOverlay showCloseButton={false} size="md" onClose={this.handleClose}>
                <Modal.Header>
                    <Modal.Title>
                        <div className={styles['device-not-recognized']}>{i18n._('Device Not Recognized')}</div>
                        <div className={styles['device-not-recognized-detail']}>{i18n._('Oops, Snapmaker Luban doesn\'t recognize your connected device.')}</div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className={styles['which-model']}>{i18n._('Which model is connected to Snapmaker Luban?')}
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
                            <div className={styles['which-toolhead']}>{i18n._('Which toolhead is attached to your Snapmaker Luban?')}</div>
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
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        btnStyle="primary"
                        onClick={this.handleConfirm}
                    >
                        {i18n._('Choose')}
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
