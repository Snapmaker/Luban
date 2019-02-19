import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import TipTrigger from '../TipTrigger';
import { NumberInput as Input } from '../Input';
import styles from '../../widgets/LaserParams/styles.styl';


class PrintOrder extends PureComponent {
    static propTypes = {
        printOrder: PropTypes.number.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired
    };

    actions = {
        onChangePrintOrder: (printOrder) => {
            this.props.updateSelectedModelPrintOrder(printOrder);
        }
    };

    render() {
        const { printOrder } = this.props;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Print Order')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Print Order')}
                                    content={i18n._('When engraving multiple images, this parameter determines the print order of the selected image. When the orders are the same, the image uploaded first will be engraved first.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={printOrder}
                                                min={1}
                                                max={10}
                                                onChange={actions.onChangePrintOrder}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={printOrder}
                                            min={1}
                                            max={10}
                                            onChange={actions.onChangePrintOrder}
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

export default PrintOrder;

