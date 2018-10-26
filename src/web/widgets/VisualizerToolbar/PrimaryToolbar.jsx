import React, { Component } from 'react';
import Detector from 'three/examples/js/Detector';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { ACTION_CANVAS_OPERATION } from '../../constants';
import styles from './primary-toolbar.styl';


class PrimaryToolbar extends Component {
    static propTypes = {
        mode: PropTypes.string.isRequired
    };
    state = this.getInitialState();

    getInitialState() {
        return {
            coordinateSystemVisible: true
        };
    }

    actions = {
        changeCoordinateVisibility: () => {
            const visible = !this.state.coordinateSystemVisible;
            this.setState({
                coordinateSystemVisible: visible
            });
            pubsub.publish(
                ACTION_CANVAS_OPERATION,
                { mode: this.props.mode, operation: 'changeCoordinateVisibility', value: visible }
            );
        }
    };

    render() {
        const actions = this.actions;
        return (
            <div>
                <div className={styles.dropdownGroup}>
                    <button
                        style={{ fontSize: '10px', padding: '3px' }}
                        type="button"
                        className="btn btn-default pull-right"
                        onClick={actions.changeCoordinateVisibility}
                        title={(!Detector.webgl)
                            ? i18n._('Enable 3D View')
                            : i18n._('Disable 3D View')
                        }
                    >
                        {this.state.coordinateSystemVisible
                            ? <i className="fa fa-toggle-on fa-fw" />
                            : <i className="fa fa-toggle-off fa-fw" />
                        }
                        <span className="space space-sm" />
                        {this.state.coordinateSystemVisible
                            ? i18n._('Hide Coordinate System')
                            : i18n._('Show Coordinate System')
                        }
                    </button>
                </div>
            </div>
        );
    }
}

export default PrimaryToolbar;
