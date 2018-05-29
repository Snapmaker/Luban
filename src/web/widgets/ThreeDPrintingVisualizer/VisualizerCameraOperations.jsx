import React, { PureComponent } from 'react';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { ACTION_3DP_MODEL_VIEW } from '../../constants';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


class VisualizerCameraOperations extends PureComponent {
    actions = {
        onZoomIn: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'zoomIn');
        },
        onZoomOut: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'zoomOut');
        },
        onLeft: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'left');
        },
        onRight: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'right');
        },
        onTop: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'top');
        },
        onBottom: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'bottom');
        },
        onReset: () => {
            pubsub.publish(ACTION_3DP_MODEL_VIEW, 'reset');
        }
    };

    render() {
        const actions = this.actions;

        return (
            <React.Fragment>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-plus', styles['zoom-in'])}
                        onClick={actions.onZoomIn}
                    />
                    <Anchor
                        className={classNames('fa', 'fa-minus', styles['zoom-out'])}
                        onClick={actions.onZoomOut}
                    />
                </div>
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
