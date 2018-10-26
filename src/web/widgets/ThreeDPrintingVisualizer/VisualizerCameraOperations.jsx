import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { ACTION_CANVAS_OPERATION } from '../../constants';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';

const MODE = '3dp';

class VisualizerCameraOperations extends PureComponent {
    actions = {
        onLeft: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: MODE, operation: 'left' });
        },
        onRight: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: MODE, operation: 'right' });
        },
        onTop: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: MODE, operation: 'top' });
        },
        onBottom: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: MODE, operation: 'bottom' });
        },
        onReset: () => {
            pubsub.publish(ACTION_CANVAS_OPERATION, { mode: MODE, operation: 'reset' });
        }
    };

    render() {
        const actions = this.actions;

        return (
            <React.Fragment>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-chevron-left', styles['turn-left'])}
                        onClick={actions.onLeft}
                    />
                </div>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-chevron-up', styles['turn-up'])}
                        onClick={actions.onTop}
                    />
                    <Anchor
                        className={classNames(styles['camera-reset'])}
                        onClick={actions.onReset}
                    />
                    <Anchor
                        className={classNames('fa', 'fa-chevron-down', styles['turn-down'])}
                        onClick={actions.onBottom}
                    />
                </div>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-chevron-right', styles['turn-right'])}
                        onClick={actions.onRight}
                    />
                </div>
            </React.Fragment>
        );
    }
}

export default VisualizerCameraOperations;
