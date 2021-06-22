import React from 'react';
import isElectron from 'is-electron';
import classNames from 'classnames';
import { Link, withRouter } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { Button } from 'antd';
import slice from 'lodash/slice';
import cloneDeep from 'lodash/cloneDeep';
import reverse from 'lodash/reverse';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';
import { COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_CENTER } from '../../../constants';


const Begin = (props) => {
    const fileInput = React.createRef();

    // redux correlation
    const dispatch = useDispatch();
    const project = useSelector(state => state?.project);
    const store = useSelector(state => state);
    const newRecentFile = reverse(cloneDeep(project.general.recentFiles));
    // method
    const onChangeFile = async (e) => {
        const file = e.target.files[0];
        const recentFile = {
            name: file.name,
            path: file.path || ''
        };
        try {
            await dispatch(projectActions.open(file, props.history));
            if (isElectron()) {
                const ipc = window.require('electron').ipcRenderer;
                ipc.send('add-recent-file', recentFile);
            }
            await dispatch(projectActions.updateRecentFile([recentFile], 'update'));
        } catch (error) {
            modal({
                title: i18n._('Failed to upload model'),
                body: error.message
            });
        }
    };

    const changeAxis = async (e, isRotate, type) => {
        e.preventDefault();
        if (!isRotate) {
            await dispatch(editorActions.changeCoordinateMode(type, COORDINATE_MODE_CENTER));
            await dispatch(editorActions.updateMaterials(type, { isRotate }));
        } else {
            const materials = store?.[type]?.materials;
            const { SVGActions } = store?.[type];
            await dispatch(editorActions.changeCoordinateMode(
                type,
                COORDINATE_MODE_BOTTOM_CENTER, {
                    x: materials.diameter * Math.PI,
                    y: materials.length
                },
                !SVGActions.svgContentGroup
            ));
            await dispatch(editorActions.updateMaterials(type, { isRotate }));
        }
        props.history.push(`/${type}`);
    };

    const onClickToUpload = () => {
        fileInput.current.value = null;
        fileInput.current.click();
    };

    return (
        <div className={styles['create-new-project']}>
            <div className={styles.beginPart}>
                <div className={styles.beginContainer}>
                    <div className={styles['title-label']}>{i18n._('Begin')}</div>
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
                                <div className={styles['laser-axis-select']}>
                                    <div
                                        className={
                                            classNames(
                                                styles.axis,
                                                styles['3-axis-select']
                                            )
                                        }
                                        onClick={(e) => changeAxis(e, false, 'laser')}
                                        aria-hidden="true"
                                    >
                                        {i18n._('3-axis')}
                                    </div>
                                    <div
                                        className={
                                            classNames(
                                                styles.axis,
                                                styles['4-axis-select']
                                            )
                                        }
                                        onClick={(e) => changeAxis(e, true, 'laser')}
                                        aria-hidden="true"
                                    >
                                        {i18n._('4-axis')}
                                    </div>
                                </div>
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
                                <div className={styles['cnc-axis-select']}>
                                    <div
                                        className={
                                            classNames(
                                                styles.axis,
                                                styles['3-axis-select']
                                            )
                                        }
                                        onClick={(e) => changeAxis(e, false, 'cnc')}
                                        aria-hidden="true"
                                    >
                                        {i18n._('3-axis')}
                                    </div>
                                    <div
                                        className={
                                            classNames(
                                                styles.axis,
                                                styles['4-axis-select']
                                            )
                                        }
                                        onClick={(e) => changeAxis(e, true, 'cnc')}
                                        aria-hidden="true"
                                    >
                                        {i18n._('4-axis')}
                                    </div>
                                </div>
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
                    <div className={styles['title-label']}>
                        {i18n._('Nearly Files')}
                    </div>
                    <div className={styles['file-container']}>
                        <div
                            className={styles['recent-file-list']}
                            // style={{ display: project.general.recentFiles?.length ? 'flex' : 'none' }}
                        >
                            {slice(newRecentFile, 0, newRecentFile.length >= 10 ? 10 : newRecentFile.length + 1).map(item => {
                                return (
                                    <div
                                        className={styles['file-item']}
                                        onClick={() => dispatch(projectActions.open(item, props.history))}
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
                            {/* <button
                                type="button"
                                className="sm-btn-small"
                                style={{ float: 'left' }}
                                title={i18n._('Open File')}
                                onClick={onClickToUpload}
                            >
                                {i18n._('Open File')}
                            </button> */}
                            <Button
                                block
                                shape="round"
                                type="primary"
                                onClick={onClickToUpload}
                            >
                                {i18n._('Open File')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

Begin.propTypes = {
    history: PropTypes.object
};

export default withRouter(Begin);
