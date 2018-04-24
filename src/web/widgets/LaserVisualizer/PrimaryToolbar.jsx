import React from 'react';
import PropTypes from 'prop-types';
import Detector from 'three/examples/js/Detector';
import i18n from '../../lib/i18n';
import styles from './primary-toolbar.styl';


const PrimaryToolbar = (props) => {
    const { state, actions } = props;
    const { disabled, objects } = state;

    return (
        <div>
            <div className={styles.dropdownGroup}>
                <button
                    style={{ fontSize: '10px', padding: '3px' }}
                    type="button"
                    className="btn btn-default pull-right"
                    title={(!Detector.webgl || disabled)
                        ? i18n._('Enable 3D View')
                        : i18n._('Disable 3D View')
                    }
                    onClick={actions.toggleCoordinateSystemVisibility}
                >
                    {objects.coordinateSystem.visible
                        ? <i className="fa fa-toggle-on fa-fw" />
                        : <i className="fa fa-toggle-off fa-fw" />
                    }
                    <span className="space space-sm" />
                    {objects.coordinateSystem.visible
                        ? i18n._('Hide Coordinate System')
                        : i18n._('Show Coordinate System')
                    }
                </button>

            </div>
        </div>
    );
};

PrimaryToolbar.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};
export default PrimaryToolbar;
