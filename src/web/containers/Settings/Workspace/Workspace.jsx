import React from 'react';
import PropTypes from 'prop-types';
import store from '../../../store';
import i18n from '../../../lib/i18n';
import styles from './index.styl';

const Workspace = (props) => {
    const { actions } = props;
    const workspaceSettings = store.get();

    return (
        <form>
            <div className={styles.formFields} style={{ marginBottom: 50 }}>
                <pre style={{ height: 400 }}>
                    <code>{JSON.stringify(workspaceSettings, null, 2)}</code>
                </pre>
            </div>
            <div className={styles.formActions}>
                <div className="row">
                    <div className="col-md-12">
                        <div className="pull-left">
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={actions.restoreDefaults}
                            >
                                {i18n._('Restore Defaults')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

Workspace.propTypes = {
    initialState: PropTypes.object,
    state: PropTypes.object,
    stateChanged: PropTypes.bool,
    actions: PropTypes.object
};

export default Workspace;
