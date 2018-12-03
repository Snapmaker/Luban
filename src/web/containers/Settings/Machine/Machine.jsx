import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import styles from '../form.styl';


class Machine extends PureComponent {
    static propTypes = {
        initialState: PropTypes.object,
        state: PropTypes.object,
        stateChanged: PropTypes.bool,
        actions: PropTypes.object
    };

    state = {
        enclosureDoorDetection: 'on'
    };

    render() {
        return (
            <div>
                <div className={styles['form-fields']}>
                    <div className={styles['form-group']}>
                        <label>{i18n._('Enclosure Door Detection')}</label>
                        <select
                            className={classNames(
                                'form-control',
                                styles['form-control'],
                                styles.short
                            )}
                            value={this.state.enclosureDoorDetection}
                        >
                            <option value="on">{i18n._('On')}</option>
                            <option value="off">{i18n._('Off')}</option>
                        </select>
                    </div>
                </div>
            </div>
        );
    }
}

export default Machine;
