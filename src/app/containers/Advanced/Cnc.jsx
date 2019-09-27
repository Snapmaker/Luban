import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class Cnccom extends PureComponent {
    static propTypes = {
        // machineSetting: PropTypes.object,
        // getMachineSetting: PropTypes.func,
        onchangeCncRpm: PropTypes.func,
        executeGcode: PropTypes.func,
        rpm: PropTypes.number
    };

    state = {
    };

    actions = {
    }

    render() {
        // const { state } = this.state;
        const { rpm } = this.props;
        const { onchangeCncRpm } = this.props;
        return (
            <div>
                <div>
                    <p>{i18n._('Cnc')}</p>
                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <p className={styles['title-row']}>{i18n._('current RPM')}</p>
                            <p className={styles['title-row']}>{rpm}</p>
                        </li>
                        <li>
                            <i className={styles['title-row']}>RPM set:</i>
                            <NumberInput
                                className={styles['input-setting']}
                                value={rpm}
                                onChange={onchangeCncRpm}
                            />
                        </li>
                        <li>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('G92 X0 Y0 Z0')}>
                                Set Original
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

export default Cnccom;
