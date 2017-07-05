import React, { Component, PropTypes } from 'react';
import pubsub from 'pubsub-js';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class QuickAccessToolbar extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    command = {
        'cyclestart': () => {
            controller.command('cyclestart');
        },
        'feedhold': () => {
            controller.command('feedhold');
        },
        'homing': () => {
            controller.command('homing');
        },
        'sleep': () => {
            controller.command('sleep');
        },
        'unlock': () => {
            controller.command('unlock');
        },
        'reset': () => {
            controller.command('reset');
        },
        'stop': () => {
            pubsub.publish('connection:stop');
        }
    };

    render() {
        return (
            <div className={styles.quickAccessToolbar}>
                <ul className="nav navbar-nav">

                    <li className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={this.command.stop}
                            title={i18n._('Reset')}
                        >
                            <i className="fa fa-undo" />
                            <span className="space" />
                            STOP
                        </button>
                    </li>
                </ul>
            </div>
        );
    }
}

export default QuickAccessToolbar;
