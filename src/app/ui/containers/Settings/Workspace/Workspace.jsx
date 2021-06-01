import React from 'react';
import PropTypes from 'prop-types';
import storeManager from '../../../../store/local-storage';
import i18n from '../../../../lib/i18n';
import styles from './index.styl';

const Workspace = (props) => {
    const { actions } = props;
    const workspaceSettings = storeManager.get();

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
                                {i18n._('Reset All User Settings')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

Workspace.propTypes = {
    actions: PropTypes.object
};

export default Workspace;
