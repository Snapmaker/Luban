import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { ACTION_CHANGE_CAMERA_ANIMATION } from '../../constants';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


class VisualizerCameraOperations extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
        })
    };

    state = {
        // camera position
        position: {
            x: 0,
            y: 0,
            z: 550
        }
    };

    actions = {
        onZoomIn: () => {
            const pos = this.state.position;
            if (pos.z <= 100) {
                return;
            }
            const property = { z: pos.z };
            const target = { z: pos.z - 100 };
            this.setState((state) => ({
                position: {
                    ...state.position,
                    z: target.z
                }
            }));

            pubsub.publish(ACTION_CHANGE_CAMERA_ANIMATION, {
                property,
                target
            });
        },
        onZoomOut: () => {
            const pos = this.state.position;
            if (pos.z >= 900) {
                return;
            }
            const property = { z: pos.z };
            const target = { z: pos.z + 100 };
            this.setState((state) => ({
                position: {
                    ...state.position,
                    z: target.z
                }
            }));

            pubsub.publish(ACTION_CHANGE_CAMERA_ANIMATION, {
                property,
                target
            });
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
                        className={classNames('fa', 'fa-angle-left', styles['turn-left'])}
                    />
                </div>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-angle-up', styles['turn-up'])}
                    />
                    <Anchor
                        className={classNames('fa', 'fa-angle-down', styles['camera-reset'])}
                    />
                    <Anchor
                        className={classNames('fa', 'fa-angle-down', styles['turn-down'])}
                    />
                </div>
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Anchor
                        className={classNames('fa', 'fa-angle-right', styles['turn-right'])}
                    />
                </div>
            </React.Fragment>
        );
    }
}

export default VisualizerCameraOperations;
