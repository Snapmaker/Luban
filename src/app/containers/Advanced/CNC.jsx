import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class CNC extends PureComponent {
    static propTypes = {
        // machineSetting: PropTypes.object,
        // getMachineSetting: PropTypes.func,
        onchangeCncRpm: PropTypes.func,
        executeGcode: PropTypes.func,
        spindleSpeed: PropTypes.number,
        rpm: PropTypes.number
    };

    state = {
    };

    actions = {
    }

    render() {
        // const { state } = this.state;
        // current RPM  remain to be solved
        const { rpm } = this.props;
        const { onchangeCncRpm, spindleSpeed } = this.props;
        return (
            <div>
                <div>
                    <p>{i18n._('CNC')}</p>
                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <p className={styles['title-row']}>{i18n._('current RPM')}</p>
                            <p className={styles['title-row']}>{spindleSpeed | null}</p>
                        </li>
                        <li>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode(`M3 P${rpm} S${rpm * 255 / 100}`)}>
                                {i18n._('On')}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('M5')}>
                                {i18n._('Off')}
                            </button>
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
                                {i18n._('Set Origin')}
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

export default CNC;
