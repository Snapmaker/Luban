import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { PAGE_EDITOR } from '../../constants';
import { actions as editorActions } from '../../flux/editor';
import styles from './styles.styl';
import Space from '../../components/Space';

class VisualizerTopRight extends PureComponent {
    static propTypes = {
        switchToPage: PropTypes.func.isRequired
    };

    actions = {
        switchToEditPage: () => {
            this.props.switchToPage(PAGE_EDITOR);
        },
        showToolPath: (flag) => {
            console.log(flag);
        },
        showSimulation: (flag) => {
            console.log(flag);
        }
    };

    render() {
        return (
            <React.Fragment>
                <div>
                    <button
                        type="button"
                        className="sm-btn-small sm-btn-primary"
                        style={{
                            float: 'left',
                            height: '40px',
                            width: '184px'
                        }}
                        title={i18n._('Back To Object View')}
                        onClick={() => this.actions.switchToEditPage()}
                    >
                        <div className={styles.topRightDiv11} />
                        <Space width={8} />
                        <div className={styles.topRightDiv12}>
                            {i18n._('Back To Object View')}
                        </div>
                    </button>
                </div>
                <div
                    className={styles['top-right-div2']}
                >
                    <div className={styles.title}>
                        {i18n._('Preview Type')}
                    </div>
                    <div className={styles.content}>
                        <input
                            type="checkbox"
                        />
                        <span>
                            {i18n._('Toolpath')}
                        </span>
                    </div>
                    <div className={styles.content}>
                        <input
                            type="checkbox"
                        />
                        <span>
                            {i18n._('Simulation')}
                        </span>
                    </div>

                </div>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = (dispatch) => ({
    switchToPage: (page) => dispatch(editorActions.switchToPage('cnc', page))
});

export default connect(null, mapDispatchToProps)(VisualizerTopRight);
