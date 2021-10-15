import React, { useState } from 'react';
import classNames from 'classnames';
import { useLocation, useHistory } from 'react-router-dom';
// import { Link, withRouter } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { slice, cloneDeep, reverse } from 'lodash';
import { renderPopup } from '../../utils';
import { Button } from '../../components/Buttons';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import Workspace from '../Workspace';
import { HEAD_PRINTING, HEAD_LASER, HEAD_CNC, MAX_RECENT_FILES_LENGTH } from '../../../constants';
import UniApi from '../../../lib/uni-api';

const Begin = () => {
    // redux correlation
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const project = useSelector(state => state?.project);
    const newRecentFile = reverse(cloneDeep(project.general.recentFiles));
    // useState
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [beginSelected, setBeginSelected] = useState('start-project');
    // method
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

    const onClickToUpload = () => {
        UniApi.Event.emit('appbar-menu:open-file-in-browser');
    };

    const handleBeginSelectedChange = (type) => {
        setBeginSelected(type);
    };

    const handleNewFile = async (isRotate, headType) => {
        UniApi.Event.emit('appbar-menu:new-file', { headType, isRotate });
    };

    return (
        <div className={classNames(styles['create-new-project'], 'tile-modal-homepage', 'homepage-widget-box-shadow')}>
            <div className={classNames(styles.beginPart)}>
                <div className={classNames('position-re', styles.headingPart)}>
                    <Anchor className={classNames(`${beginSelected === 'start-project' ? 'highlight-heading homepage-selected-border' : 'highlight-heading-unselect-with-hover'}`, 'margin-horizontal-24')} onClick={() => handleBeginSelectedChange('start-project')}>{i18n._('key-HomePage/Begin-Get Started')}</Anchor>
                    <Anchor className={classNames(`${beginSelected === 'nearly-file' ? 'highlight-heading homepage-selected-border' : 'highlight-heading-unselect-with-hover'}`)} onClick={() => handleBeginSelectedChange('nearly-file')}>{i18n._('key-HomePage/Begin-Recent Project')}</Anchor>
                    <Button
                        width="11.11vw"
                        className={classNames('position-ab', 'right-16')}
                        type="default"
                        priority="level-three"
                        onClick={onClickToUpload}
                    >
                        {i18n._('key-HomePage/Begin-Open Project')}
                    </Button>
                </div>
                <div className={styles.beginContainer}>
                    {beginSelected === 'start-project' && (
                        <div className={classNames(styles['link-bar'], 'margin-vertical-48')}>
                            <div className={classNames(styles['3dp'], 'margin-horizontal-16')}>
                                <Anchor onClick={() => handleNewFile(false, HEAD_PRINTING)} title={i18n._('key-HomePage/Begin-3D Printing G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img src={require('./images/icon_3d_120x120.svg')} alt="" />
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('key-HomePage/Begin-3D Printing')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.laser, 'margin-horizontal-16')}>
                                <Anchor title={i18n._('key-HomePage/Begin-Laser G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img className={classNames(styles['laser-img'])} src={require('./images/icon_laser_120x120.svg')} alt="" />
                                        <div className={styles['laser-axis-select']}>
                                            <Button onClick={() => { handleNewFile(false, HEAD_LASER); }} className={classNames(styles['three-axis-select'])} type="default" priority="level-three">
                                                {i18n._('key-HomePage/Begin-3-axis')}
                                            </Button>
                                            <Button onClick={() => { handleNewFile(true, HEAD_LASER); }} className={classNames(styles['four-axis-select'])} type="default" priority="level-three">
                                                {i18n._('key-HomePage/Begin-4-axis')}
                                            </Button>
                                        </div>
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('key-HomePage/Begin-Laser')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.cnc, 'margin-horizontal-16')}>
                                <Anchor title={i18n._('key-HomePage/Begin-CNC G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img className={classNames(styles['cnc-img'])} src={require('./images/icon_cnc_120x120.svg')} alt="" />
                                        <div className={styles['cnc-axis-select']}>
                                            <Button onClick={() => { handleNewFile(false, HEAD_CNC); }} className={classNames(styles['three-axis-select'])} type="default" priority="level-three">
                                                {i18n._('key-HomePage/Begin-3-axis')}
                                            </Button>
                                            <Button onClick={() => { handleNewFile(true, HEAD_CNC); }} className={classNames(styles['four-axis-select'])} type="default" priority="level-three">
                                                {i18n._('key-HomePage/Begin-4-axis')}
                                            </Button>
                                        </div>
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('key-HomePage/Begin-CNC')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.workspace, 'margin-horizontal-16')}>
                                <Anchor onClick={() => handleSwitchToWorkspace('/workspace')} title={i18n._('key-HomePage/Begin-Workspace')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img src={require('./images/icon_workspace_120x120.svg')} alt="" />
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('key-HomePage/Begin-Workspace')}</span>
                                </Anchor>
                            </div>
                        </div>
                    )}
                    {
                        beginSelected === 'nearly-file' && (
                            <div className={classNames(styles.nearlyFile, 'margin-vertical-48')}>
                                <div className={classNames(styles['recent-file-list'])}>
                                    {slice(newRecentFile, 0, newRecentFile.length >= MAX_RECENT_FILES_LENGTH ? MAX_RECENT_FILES_LENGTH : newRecentFile.length + 1).map((item) => {
                                        const tempArr = item.name.split('.');
                                        const fileName = tempArr.slice(0, tempArr.length - 1).join('.');
                                        const suffixName = tempArr[tempArr.length - 1];
                                        return (
                                            <div
                                                className={classNames(styles['file-item'], 'heading-3-normal-with-hover')}
                                                onClick={() => dispatch(projectActions.openProject(item, history))}
                                                aria-hidden="true"
                                            >
                                                <span className={classNames(styles['file-name'])}>{fileName}</span>
                                                <span className={classNames(styles['suffix-name'])}>{`(.${suffixName})`}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
            {renderWorkspace()}
        </div>
    );
};

export default Begin;
