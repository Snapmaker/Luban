import React, { useState, useEffect } from 'react';
import { useDispatch, connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import isElectron from 'is-electron';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import { renderModal } from '../../utils';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import { controller } from '../../../lib/controller';
import { WORKFLOW_STATE_IDLE } from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import MainToolBar from '../../layouts/MainToolBar';
import { PageMode } from '../PageMode';

const resourceDomain = 'http://localhost:8085';
// const resourceDomain = 'http://45.79.80.155:8085';
let willMakeList = [];
let willWorkspaceList = [];

const CaseResource = (props) => {
    const { history } = props;
    const [isModalOpen, setIsModalOpen] = useState(false);
    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [pageMode, setPageMode] = useState(PageMode.Default);

    const dispatch = useDispatch();
    const handleResize = () => {
        const iframe = document.querySelector('#resource-iframe');
        window.addEventListener('resize', () => {
            iframe.style.height = `calc(${window.innerHeight}px - 8px)`;
        });
    };
    const handleMessage = () => {
        window.addEventListener('message', (event) => {
            if (event.origin === resourceDomain) {
                console.log('get event from iframe:', event);
                switch (event.data.type) {
                    case 'make': {
                        willMakeList.push(event.data.filename);
                        break;
                    }
                    case 'workspace': {
                        willWorkspaceList.push(event.data.filename);
                        break;
                    }
                    case 'download': {
                        console.log('download');
                        break;
                    }
                    default:
                }
            }
        });
    };
    const handleDownloadFile = () => {
        if (!isElectron()) return;
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.on('filedownload', (event, args) => {
            const path = JSON.parse(args).savePath;
            const pathArr = path.split('\\');
            const filename = pathArr[pathArr.length - 1];
            console.log(args, pathArr, filename);
            console.log(willMakeList);
            console.log('download file finish:', filename);
            if (willMakeList.some((v) => v === filename)) {
                console.log('openProject by downloaded file:', filename);
                props.openProject(
                    {
                        name: filename,
                        path: path || '',
                    },
                    props.history
                );
                willMakeList = willMakeList.filter((v) => v !== filename);
                console.log(willMakeList);
            }

            const canWorkspaceLoad = controller.workflowState === WORKFLOW_STATE_IDLE;
            console.log(willWorkspaceList, filename);
            console.log(
                willWorkspaceList.some((v) => v === filename),
                canWorkspaceLoad
            );
            if (
                willWorkspaceList.some((v) => v === filename)
                && canWorkspaceLoad
            ) {
                console.log('go to workspace by downloaded file:', filename);
                dispatch(
                    workspaceActions.uploadGcodeFile({
                        path: path,
                        name: filename,
                        // size
                    })
                );
                willWorkspaceList = willWorkspaceList.filter(
                    (v) => v !== filename
                );
                history.push('/workspace');
                console.log(willWorkspaceList);
            }
        });
    };
    useEffect(() => {
        handleResize();
        // setIsOk(true);
        handleMessage();

        handleDownloadFile();
    }, []);

    const renderDevelopToolsModal = () => {
        const onClose = () => setIsModalOpen(false);
        return renderModal({
            title: i18n._('key-App/Settings/FirmwareTool-Firmware Tool'),
            renderBody: () => {
                return <div>model~~</div>;
            },
            onClose,
            actions: [
                {
                    name: i18n._('key-App/Settings/Preferences-Cancel'),
                    onClick: () => {
                        onClose();
                    },
                },
                {
                    name: i18n._(
                        'key-App/Settings/FirmwareTool-Pack and Export'
                    ),
                    isPrimary: true,
                    isAutoWidth: true,
                    onClick: () => {
                        onClose();
                    },
                },
            ],
        });
    };

    return (
        <>
            <MainToolBar
                leftItems={[
                    {
                        title: 'key-Workspace/Page-Back',
                        name: 'MainToolbarBack',
                        action: () => (props?.isPopup ? props.onClose() : history.push('/home')),
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model Simplify'),
                        // disabled: !canSimplify || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarDownloadManager',
                        action: async () => {
                            if (pageMode === PageMode.Simplify) {
                                // Click again will not exit simplify page mode
                                // setPageMode(PageMode.Default);
                            } else {
                                setPageMode(PageMode.Simplify);
                            }
                        }
                    },
                ]}
                mainBarClassName="background-transparent"
                lang={i18next.language}
            />
            <div>
                {isModalOpen ? renderDevelopToolsModal() : null}
                <iframe
                    id="resource-iframe"
                    style={{
                        width: '100%',
                        height: `calc(${window.innerHeight}px - 8px)`,
                    }}
                    src={`${resourceDomain}/resource-list`}
                    frameBorder="0"
                    title="case-resource"
                />
                {/* <iframe style={{ width: '100%', height: `calc(${window.innerHeight}px - 8px)` }} src="http://45.79.80.155:8085/resource-list" frameBorder="0" title="case-resource" /> */}
            </div>
        </>
    );
};
CaseResource.propTypes = {
    openProject: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onClose: PropTypes.func,
    isPopup: PropTypes.bool
};

const mapDispatchToProps = (dispatch) => {
    return {
        openProject: (file, history) => dispatch(projectActions.openProject(file, history)),
    };
};
export default withRouter(
    connect(() => {
        return {};
    }, mapDispatchToProps)(CaseResource)
);
