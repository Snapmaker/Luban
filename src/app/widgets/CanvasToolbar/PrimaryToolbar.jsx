import React, { Component } from 'react';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './primary-toolbar.styl';


class PrimaryToolbar extends Component {
    static propTypes = {
        actions: PropTypes.object.isRequired,
        state: PropTypes.object.isRequired
    };

    render() {
        const { switchCoordinateVisibility } = { ...this.props.actions, ...this.props.state };
        return (
            <div>
                <div className={styles.dropdownGroup}>
                    <button
                        style={{ fontSize: '10px', padding: '3px' }}
                        type="button"
                        className="btn btn-default pull-right"
                        onClick={switchCoordinateVisibility}
                        title={(!Detector.webgl)
                            ? i18n._('Enable 3D View')
                            : i18n._('Disable 3D View')
                        }
                    />
                </div>
            </div>
        );
    }
}

export default PrimaryToolbar;
