import { Machine, MachineType } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import { cloneDeep, reverse, slice } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, MAX_RECENT_FILES_LENGTH } from '../../../constants';
import { RootState } from '../../../flux/index.def';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
import { SnapmakerRayMachine } from '../../../machines';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import { renderPopup } from '../../utils';
import Workspace from '../Workspace';
import { LaserWorkspaceRay } from '../laser-workspace-ray';
import print3DEntryIcon from './images/icon_3d_120x120.svg';
import cncEntryIcon from './images/icon_cnc_120x120.svg';
import laserEntryIcon from './images/icon_laser_120x120.svg';
import workspaceEntryIcon from './images/icon_workspace_120x120.svg';
import styles from './styles.styl';


const StartProject: React.FC = () => {
    // redux correlation
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();

    const project = useSelector((state: RootState) => state.project);
    const activeMachine = useSelector((state: RootState) => state.machine.activeMachine) as Machine;

    const newRecentFile = reverse(cloneDeep(project.general.recentFiles));

    // useState
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [beginSelected, setBeginSelected] = useState('start-project');

    // method
    const renderWorkspace = useCallback(() => {
        if (!showWorkspace) {
            return null;
        }

        const onClose = () => setShowWorkspace(false);

        let component = Workspace;
        if (activeMachine?.identifier === SnapmakerRayMachine.identifier) {
            component = LaserWorkspaceRay;
        }

        return renderPopup({
            onClose,
            component,
        });
    }, [showWorkspace, activeMachine?.identifier]);

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

    const handleNewFile = async (isRotate: boolean, headType) => {
        UniApi.Event.emit('appbar-menu:new-file', { headType, isRotate });
    };

    const isMultiFunctionMachine = activeMachine && activeMachine.machineType === MachineType.MultiFuncionPrinter;
    const is3DPrinter = activeMachine && activeMachine.machineType === MachineType.Printer;
    const isLaserMachine = activeMachine && activeMachine.machineType === MachineType.Laser;

    const recentFiles = useMemo(() => {
        if (newRecentFile.length >= MAX_RECENT_FILES_LENGTH) {
            return slice(newRecentFile, 0, MAX_RECENT_FILES_LENGTH);
        } else {
            return slice(newRecentFile, 0, newRecentFile.length + 1);
        }
    }, [newRecentFile]);

    return (
        <div id="start-project" className={classNames(styles['create-new-project'], 'tile-modal-homepage', 'homepage-widget-box-shadow')}>
            <div className={classNames(styles.beginPart)}>
                <div className={classNames('position-re', styles.headingPart)}>
                    <Anchor
                        className={classNames(`${beginSelected === 'start-project' ? 'highlight-heading homepage-selected-border' : 'highlight-heading-unselect-with-hover'}`, 'margin-horizontal-24')}
                        onClick={() => handleBeginSelectedChange('start-project')}
                    >
                        {i18n._('key-HomePage/Begin-Get Started')}
                    </Anchor>
                    <Anchor
                        className={classNames(`${beginSelected === 'recent-files' ? 'highlight-heading homepage-selected-border' : 'highlight-heading-unselect-with-hover'}`)}
                        onClick={() => handleBeginSelectedChange('recent-files')}
                    >
                        {i18n._('key-HomePage/Begin-Recent Project')}
                    </Anchor>
                    <Button
                        width="11.11vw"
                        className={classNames('position-absolute', 'right-16')}
                        type="default"
                        priority="level-three"
                        onClick={onClickToUpload}
                    >
                        {i18n._('key-HomePage/Begin-Open Project')}
                    </Button>
                </div>
                <div className={styles['begin-container']}>
                    {
                        beginSelected === 'start-project' && (
                            <div className={classNames(styles['link-bar'], 'margin-top-36', 'margin-bottom-72')}>
                                {
                                    (isMultiFunctionMachine || is3DPrinter) && (
                                        <div className={classNames(styles['link-bar-item'], 'margin-horizontal-16')}>
                                            <Anchor onClick={async () => handleNewFile(false, HEAD_PRINTING)} title={i18n._('key-HomePage/Begin-3D Printing G-code Generator')}>
                                                <div className={classNames(styles.imgWrapper)}>
                                                    <img src={print3DEntryIcon} alt="" />
                                                </div>
                                                <span className={classNames('heading-2', 'align-c', 'text-overflow-ellipsis-line-2', 'width-one-in-six')}>{i18n._('key-HomePage/Begin-3D Printing')}</span>
                                            </Anchor>
                                        </div>
                                    )
                                }
                                {
                                    (isMultiFunctionMachine || isLaserMachine) && (
                                        <div className={classNames(styles['link-bar-item'], styles.laser, 'margin-horizontal-16')}>
                                            <Anchor title={i18n._('key-HomePage/Begin-Laser G-code Generator')}>
                                                <div className={classNames(styles.imgWrapper)}>
                                                    <img className={classNames(styles['laser-img'])} src={laserEntryIcon} alt="" />
                                                    <div className={styles['laser-axis-select']}>
                                                        <Button
                                                            onClick={() => {
                                                                handleNewFile(false, HEAD_LASER);
                                                            }}
                                                            className={classNames(styles['three-axis-select'])}
                                                            type="default"
                                                            priority="level-three"
                                                        >
                                                            {i18n._('key-HomePage/Begin-3-axis')}
                                                        </Button>
                                                        <Button
                                                            onClick={() => {
                                                                handleNewFile(true, HEAD_LASER);
                                                            }}
                                                            className={classNames(styles['four-axis-select'])}
                                                            type="default"
                                                            priority="level-three"
                                                        >
                                                            {i18n._('key-HomePage/Begin-4-axis')}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <span className={classNames('heading-2', 'align-c', 'text-overflow-ellipsis-line-2', 'width-one-in-six')}>{i18n._('key-HomePage/Begin-Laser')}</span>
                                            </Anchor>
                                        </div>
                                    )
                                }
                                {
                                    isMultiFunctionMachine && (
                                        <div className={classNames(styles['link-bar-item'], styles.cnc, 'margin-horizontal-16')}>
                                            <Anchor title={i18n._('key-HomePage/Begin-CNC G-code Generator')}>
                                                <div className={classNames(styles.imgWrapper)}>
                                                    <img className={classNames(styles['cnc-img'])} src={cncEntryIcon} alt="" />
                                                    <div className={styles['cnc-axis-select']}>
                                                        <Button
                                                            onClick={() => {
                                                                handleNewFile(false, HEAD_CNC);
                                                            }}
                                                            className={classNames(styles['three-axis-select'])}
                                                            type="default"
                                                            priority="level-three"
                                                        >
                                                            {i18n._('key-HomePage/Begin-3-axis')}
                                                        </Button>
                                                        <Button
                                                            onClick={() => {
                                                                handleNewFile(true, HEAD_CNC);
                                                            }}
                                                            className={classNames(styles['four-axis-select'])}
                                                            type="default"
                                                            priority="level-three"
                                                        >
                                                            {i18n._('key-HomePage/Begin-4-axis')}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <span className={classNames('heading-2', 'align-c', 'text-overflow-ellipsis-line-2', 'width-one-in-six')}>{i18n._('key-HomePage/Begin-CNC')}</span>
                                            </Anchor>
                                        </div>
                                    )
                                }
                                <div className={classNames(styles['link-bar-item'], 'margin-horizontal-16')}>
                                    <Anchor onClick={() => handleSwitchToWorkspace('/workspace')} title={i18n._('key-HomePage/Begin-Workspace')}>
                                        <div className={classNames(styles.imgWrapper)}>
                                            <img src={workspaceEntryIcon} alt="" />
                                        </div>
                                        <span className={classNames('heading-2', 'align-c', 'text-overflow-ellipsis-line-2', 'width-one-in-six')}>{i18n._('key-HomePage/Begin-Workspace')}</span>
                                    </Anchor>
                                </div>
                            </div>
                        )
                    }
                    {
                        beginSelected === 'recent-files' && (
                            <div className={classNames(styles['recent-files'], 'margin-vertical-48')}>
                                <div className={classNames(styles['recent-file-list'])}>
                                    {
                                        recentFiles.map((item) => {
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
                                        })
                                    }
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

export default StartProject;
