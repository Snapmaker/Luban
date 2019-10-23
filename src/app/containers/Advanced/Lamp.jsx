import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class LightBar extends PureComponent {
    static propTypes = {
        executeGcode: PropTypes.func,
        setLightMode: PropTypes.func
    };

    state = {
        brightness: 50,
        lightStatus: false
    };

    actions = {
        onchangeBrightness: (brightness) => {
            this.setState({ brightness });
        },
        switchLightBar: () => {
            const { lightStatus } = this.state;
            this.setState({ lightStatus: !lightStatus });
            this.props.executeGcode('set light status', { lightStatus: !lightStatus });
        }
    }

    render() {
        return (
            <div>
                <p>{i18n._('Light Bar')}</p>
                <ul style={{ listStyle: 'none' }}>
                    <li>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('get light status')}>
                            {i18n._('Get Status')}
                        </button>
                    </li>
                    <li>
                        <NumberInput
                            className={styles['input-setting']}
                            value={this.state.brightness}
                            onChange={this.actions.onchangeBrightness}
                        />
                        <input
                            type="checkbox"
                            checked={this.state.lightStatus}
                            onChange={this.actions.switchLightBar}
                        />
                        {i18n._('Switch Light')}
                        <br />
                    </li>
                    <li>
                        <input type="radio" name="browser" onClick={() => this.props.setLightMode('status')} />
                        {i18n._('Status')}
                        <br />
                        <input type="radio" name="browser" onClick={() => this.props.setLightMode('light')} />
                        {i18n._('Light')}
                        <br />
                    </li>
                </ul>
            </div>
        );
    }
}

export default LightBar;
