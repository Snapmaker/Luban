import React from 'react';
import classNames from 'classnames';
import { Link, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { actions as projectActions } from '../../../flux/project';


const Begin = (props) => {
    const fileInput = React.createRef();

    // method
    const onChangeFile = async (e) => {
        const file = e.target.files[0];
        const recentFile = {
            name: file.name,
            path: file.path || ''
        };
        console.log(file, file.path, recentFile);
        try {
            console.log(props.openFile);
            await props.openFile(file, props.history);
            await props.updateRecentFile([recentFile], 'update');
        } catch (error) {
            console.log({ error });
            modal({
                title: i18n._('Failed to upload model'),
                body: error.message
            });
        }
    };

    const onClickToUpload = () => {
        fileInput.current.value = null;
        fileInput.current.click();
    };

    return (
        <div className={styles['create-new-project']}>
            <div className={styles['title-label']}>{i18n._('Begin')}</div>
            <div className={styles.beginPart}>
                <div className={styles.beginContainer}>
                    <div className={styles['sub-title']}>{i18n._('Begin')}</div>
                    <div className={styles['link-bar']}>
                        <div className={styles['3dp']}>
                            <Link to="/3dp" title={i18n._('3D Printing G-code Generator')} draggable="false">
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-3dp']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('3DP')}</span>
                            </Link>
                        </div>
                        <div className={styles.laser}>
                            <Link to="/laser" title={i18n._('Laser G-code Generator')} draggable="false">
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-laser']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('Laser')}</span>
                            </Link>
                        </div>
                        <div className={styles.cnc}>
                            <Link to="/cnc" title={i18n._('CNC G-code Generator')} draggable="false">
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-cnc']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('CNC')}</span>
                            </Link>
                        </div>
                        <div className={styles.workspace}>
                            <Link to="/workspace" title={i18n._('Workspace')} draggable="false">
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-xyz']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('Workspace')}</span>
                            </Link>
                        </div>
                    </div>
                </div>
                <div className={styles['nearly-container']}>
                    <div className={styles['sub-title']}>
                        {i18n._('Nearly Files')}
                    </div>
                    <div className={styles['file-container']}>
                        <div
                            className={styles['recent-file-list']}
                            style={{ display: props.project.general.recentFiles?.length ? 'flex' : 'none' }}
                        >
                            {props.project.general.recentFiles.map(item => {
                                return (
                                    <div
                                        className={styles['file-item']}
                                        onClick={() => props.openFile(item, props.history)}
                                        aria-hidden="true"
                                    >
                                        {item.name}
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles['open-file-btn']}>
                            <input
                                ref={fileInput}
                                type="file"
                                accept=".snap3dp, .snaplzr, .snapcnc, .gcode, .cnc, .nc"
                                style={{ display: 'none' }}
                                multiple={false}
                                onChange={(e) => onChangeFile(e)}
                                id="file-input"
                            />
                            <button
                                type="button"
                                className="sm-btn-small sm-btn-primary"
                                style={{ float: 'left' }}
                                title={i18n._('Open File')}
                                onClick={onClickToUpload}
                            >
                                {i18n._('Open File')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

Begin.propTypes = {
    openFile: PropTypes.func.isRequired,
    updateRecentFile: PropTypes.func.isRequired,
    history: PropTypes.object,
    project: PropTypes.object
};

const mapStateToProps = (state) => {
    const project = state.project;
    return {
        project
    };
};
const mapDispatchToProps = (dispatch) => ({
    openFile: (file, history) => dispatch(projectActions.open(file, history)),
    updateRecentFile: (arr, type) => dispatch(projectActions.updateRecentFile(arr, type))
});

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Begin));
