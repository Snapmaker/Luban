import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';


class VisualizerCameraOperations extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
        })
    };

    actions = {
        onZoomIn: () => {
            console.error('Zoom In');
        },
        onZoomOut: () => {
            console.error('Zoom Out');
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
                <img
                    className={styles['steering-meter']}
                    src="images/camera-steering-meter-bg.png" alt=""
                />
            </React.Fragment>
        );
    }
}

export default VisualizerCameraOperations;
