import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';

import i18n from '../../lib/i18n';
import styles from './workflow-control.styl';

class WorkflowControl extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };
    fileInputEl = null;

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    onClickToUpload() {
        console.log('upload log');
    }
    render() {
        return (
            <div className={styles.workflowControl}>
                <div className="btn-toolbar">
                    <div className="btn-group btn-group-sm">
                        <button
                            type="button"
                            className="btn btn-primary"
                            title={i18n._('Upload G-code')}
                            onClick={::this.onClickToUpload}
                        >
                            {i18n._('Upload G-code')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default WorkflowControl;
