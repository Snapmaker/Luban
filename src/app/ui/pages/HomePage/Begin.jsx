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
import { HEAD_LASER, HEAD_CNC, HEAD_3DP } from '../../../constants';
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

    const handleChangeAxis = async (isRotate, headType) => {
        UniApi.Event.emit('appbar-menu:new-file', { headType, isRotate });
    };

    return (
        <div className={classNames(styles['create-new-project'], 'tile-modal-homepage')}>
            <div className={styles.beginPart}>
                <div className={classNames('position-re', styles.headingPart)}>
                    <Anchor className={classNames(`${beginSelected === 'start-project' ? 'highlight-heading' : 'highlight-heading-unselect-with-hover'}`, 'margin-horizontal-24')} onClick={() => handleBeginSelectedChange('start-project')}>{i18n._('Get Started')}</Anchor>
                    <Anchor className={classNames(`${beginSelected === 'nearly-file' ? 'highlight-heading' : 'highlight-heading-unselect-with-hover'}`)} onClick={() => handleBeginSelectedChange('nearly-file')}>{i18n._('Recent Files')}</Anchor>
                    <Button
                        width="11.11vw"
                        className={classNames('position-ab', 'right-16')}
                        type="default"
                        priority="level-three"
                        onClick={onClickToUpload}
                    >
                        {i18n._('Open File')}
                    </Button>
                </div>
                <div className={styles.beginContainer}>
                    {beginSelected === 'start-project' && (
                        <div className={classNames(styles['link-bar'], 'margin-vertical-48')}>
                            <div className={classNames(styles['3dp'], 'margin-horizontal-16')}>
                                <Anchor onClick={() => handleChangeAxis(false, HEAD_3DP)} title={i18n._('3D Printing G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img src={require('./images/icon_3d_120x120.svg')} alt="" />
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('3DP')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.laser, 'margin-horizontal-16')}>
                                <Anchor title={i18n._('Laser G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img className={classNames(styles['laser-img'])} src={require('./images/icon_laser_120x120.svg')} alt="" />
                                        <div className={styles['laser-axis-select']}>
                                            <Button onClick={() => { handleChangeAxis(false, HEAD_LASER); }} className={classNames(styles['three-axis-select'])} type="default" priority="level-three">
                                                {i18n._('3-axis')}
                                            </Button>
                                            <Button onClick={() => { handleChangeAxis(true, HEAD_LASER); }} className={classNames(styles['four-axis-select'])} type="default" priority="level-three">
                                                {i18n._('4-axis')}
                                            </Button>
                                        </div>
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('Laser')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.cnc, 'margin-horizontal-16')}>
                                <Anchor title={i18n._('CNC G-code Generator')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img className={classNames(styles['cnc-img'])} src={require('./images/icon_cnc_120x120.svg')} alt="" />
                                        <div className={styles['cnc-axis-select']}>
                                            <Button onClick={() => { handleChangeAxis(false, HEAD_CNC); }} className={classNames(styles['three-axis-select'])} type="default" priority="level-three">
                                                {i18n._('3-axis')}
                                            </Button>
                                            <Button onClick={() => { handleChangeAxis(true, HEAD_CNC); }} className={classNames(styles['four-axis-select'])} type="default" priority="level-three">
                                                {i18n._('4-axis')}
                                            </Button>
                                        </div>
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('CNC')}</span>
                                </Anchor>
                            </div>
                            <div className={classNames(styles.workspace, 'margin-horizontal-16')}>
                                <Anchor onClick={() => handleSwitchToWorkspace('/workspace')} title={i18n._('Workspace')}>
                                    <div className={classNames(styles.imgWrapper)}>
                                        <img src={require('./images/icon_workspace_120x120.svg')} alt="" />
                                    </div>
                                    <span className={classNames('heading-2')}>{i18n._('Workspace')}</span>
                                </Anchor>
                            </div>
                        </div>
                    )}
                    {
                        beginSelected === 'nearly-file' && (
                            <div className={classNames(styles.nearlyFile, 'margin-vertical-48')}>
                                <div className={classNames(styles['recent-file-list'])}>
                                    {slice(newRecentFile, 0, newRecentFile.length >= 10 ? 10 : newRecentFile.length + 1).map((item) => {
                                        return (
                                            <div
                                                className={styles['file-item']}
                                                onClick={() => dispatch(projectActions.openProject(item, history))}
                                                aria-hidden="true"
                                            >
                                                <span className={classNames('heading-3-normal-with-hover')}>{item.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                </div>
            </div>
            {renderWorkspace()}
        </div>
    );
};

export default Begin;
