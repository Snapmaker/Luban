import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';
import { BOUND_SIZE } from '../../constants';
import { actions } from '../../reducers/modules/laser';
import { NumberInput as Input } from '../../components/Input';
import modal from '../../lib/modal';
import UploadControl from '../LaserParams/UploadControl';


class Stock extends PureComponent {
    static propTypes = {
        stock: PropTypes.object.isRequired,

        // redux actions
        setStock: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired,
        remap: PropTypes.func.isRequired,
    };

    actions = {
        onLoadGcode: () => {
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            let content = 0;
            const size = 100;
            content += 'G0 X0 Y0 F3000\n';
            content += 'M3\n';
            content += 'G1 F200';
            content += `G1 X${size} Y0\n`;
            content += `G1 X${size} Y${size}\n`;
            content += `G1 X0 Y${size}\n`;
            content += 'G1 X0 Y0\n';
            content += 'M5\n';

            pubsub.publish('gcode:upload', {
                gcode: content,
                meta: {
                    name: 'Generated from Stock Settings',
                    renderMethod: 'line',
                }
            });
        },
        onChangePosition: (p, coordinate) => {
            return (value) => {
                let stock = this.props.stock;
                stock[p][coordinate] = value;
                this.props.setStock(stock);
            };
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        },
    };

    render() {
        const { stock } = this.props;
        const actions = this.actions;
        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onLoadGcode}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Print Square Plate')}
                </button>

                <UploadControl
                    accept={stock.accept}
                    onChangeFile={this.actions.onChangeFile}
                    filename={stock.filename}
                    width={stock.width}
                    height={stock.height}
                />

                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Left Bottom')}
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p0.x}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p0', 'x')}
                                />
                                <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p0.y}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p0', 'y')}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Right Bottom')}
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p1.x}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p1', 'x')}
                                />
                                <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p1.y}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p1', 'y')}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Right Top')}
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p2.x}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p2', 'x')}
                                />
                                <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p2.y}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p2', 'y')}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Left Top')}
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p3.x}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p3', 'x')}
                                />
                                <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={stock.p3.y}
                                    min={-BOUND_SIZE}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangePosition('p3', 'y')}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>

                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={this.props.remap}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('ReMap')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        stock: state.laser.stock,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setStock: (params) => dispatch(actions.stockSetState(params)),
        uploadImage: (params) => dispatch(actions.uploadStockImage(params)),
        remap: () => dispatch(actions.remap()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Stock);
