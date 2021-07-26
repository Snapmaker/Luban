import React, { useState } from 'react';
import classNames from 'classnames';
import { useHistory, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
// import PropTypes from 'prop-types';
import { slice, cloneDeep, reverse } from 'lodash';
import { renderPopup } from '../../utils';
import { Button } from '../../components/Buttons';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';
import { COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_CENTER, HEAD_LASER, HEAD_CNC } from '../../../constants';
import UniApi from '../../../lib/uni-api';
import Workspace from '../Workspace';


const Begin = () => {
    // redux correlation
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const project = useSelector(state => state?.project);
    const store = useSelector(state => state);
    const newRecentFile = reverse(cloneDeep(project.general.recentFiles));
    const [showWorkspace, setShowWorkspace] = useState(false);
    // method
    const onStartProject = async (pathname) => {
        const oldPathname = location?.pathname;
        await dispatch(projectActions.startProject(oldPathname, pathname, history));
        return null;
    };
    function renderWorkspace() {
        const onClose = () => setShowWorkspace(false);
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }
    function handleSwitchToWorkspace(pathname) {
        const oldPathname = location?.pathname;
        if (oldPathname === '/') {
            history.push(pathname);
        } else {
            setShowWorkspace(true);
        }
    }

    const changeAxis = async (e, isRotate, headType) => {
        e.preventDefault();
        if (!isRotate) {
            const { materials } = store?.[headType];
            if (materials.isRotate !== isRotate) {
                await dispatch(editorActions.changeCoordinateMode(headType, COORDINATE_MODE_CENTER));
                await dispatch(editorActions.updateMaterials(headType, { isRotate }));
            }
        } else {
            const { SVGActions, materials } = store?.[headType];
            if (materials.isRotate !== isRotate) {
                await dispatch(editorActions.changeCoordinateMode(
                    headType,
                    COORDINATE_MODE_BOTTOM_CENTER, {
                        x: materials.diameter * Math.PI,
                        y: materials.length
                    },
                    !SVGActions.svgContentGroup
                ));
                await dispatch(editorActions.updateMaterials(headType, { isRotate }));
            }
        }
    };

    const onClickToUpload = () => {
        UniApi.Event.emit('appbar-menu:open-file-in-browser');
    };
    return (
        <div className={styles['create-new-project']}>
            <div className={styles.beginPart}>
                <div className={styles.beginContainer}>
                    <div className={styles['title-label']}>{i18n._('Begin')}</div>
                    <div className={styles['link-bar']}>
                        <div className={styles['3dp']}>
                            <Anchor onClick={() => onStartProject('/3dp')} title={i18n._('3D Printing G-code Generator')}>
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-3dp']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('3DP')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.laser}>
                            <Anchor onClick={() => onStartProject('/laser')} title={i18n._('Laser G-code Generator')}>
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
                                        onClick={(e) => changeAxis(e, false, HEAD_LASER)}
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
                                        onClick={(e) => changeAxis(e, true, HEAD_LASER)}
                                        aria-hidden="true"
                                    >
                                        {i18n._('4-axis')}
                                    </div>
                                </div>
                                <span className={styles['common-label']}>{i18n._('Laser')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.cnc}>
                            <Anchor onClick={() => onStartProject('/cnc')} title={i18n._('CNC G-code Generator')}>
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
                                        onClick={(e) => changeAxis(e, false, HEAD_CNC)}
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
                                        onClick={(e) => changeAxis(e, true, HEAD_CNC)}
                                        aria-hidden="true"
                                    >
                                        {i18n._('4-axis')}
                                    </div>
                                </div>
                                <span className={styles['common-label']}>{i18n._('CNC')}</span>
                            </Anchor>
                        </div>
                        <div className={styles.workspace}>
                            <Anchor onClick={() => handleSwitchToWorkspace('/workspace')} title={i18n._('Workspace')}>
                                <i className={
                                    classNames(
                                        styles.icon,
                                        styles['icon-xyz']
                                    )}
                                />
                                <span className={styles['common-label']}>{i18n._('Workspace')}</span>
                            </Anchor>
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
                                        key={item?.name}
                                        onClick={() => dispatch(projectActions.openProject(item, history))}
                                        aria-hidden="true"
                                    >
                                        {item.name}
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles['open-file-btn']}>
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
                                type="primary"
                                priority="level-one"
                                width="100%"
                                onClick={onClickToUpload}
                            >
                                {i18n._('Open File')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {renderWorkspace()}
        </div>
    );
};

export default Begin;
