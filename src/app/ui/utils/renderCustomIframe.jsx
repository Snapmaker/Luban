import React from 'react';
import i18next from 'i18next';
import Modal from '../components/Modal/tileModal';
import CustomIframe from '../CustomIframe';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import MainToolBar from '../layouts/MainToolBar';
// import i18n from '../../lib/i18n';

export default function renderCustomIframe(options) {
    const { onClose, visible = true, showDownloadPopup } = options;

    const renderMainToolBar = () => {
        return (
            <MainToolBar
                leftItems={[
                    {
                        title: 'key-Workspace/Page-Back',
                        name: 'MainToolbarBack',
                        action: () => onClose && onClose()
                    }
                ]}
                rightItems={[
                    {
                        title: 'key-Workspace/Page-Back',
                        name: 'MainToolbarBack',
                        action: () => showDownloadPopup && showDownloadPopup()
                    }
                ]}
                mainBarClassName="background-transparent"
                lang={i18next.language}
            />
        );
    };

    return (
        <Modal closable={false} disableOverlay tile style={{ width: '100%', height: '100%', display: visible ? 'block' : 'none' }} onClose={onClose}>

            <WorkspaceLayout
                renderMainToolBar={renderMainToolBar}
            >
                <CustomIframe
                    allow="fullscreen"
                    width="100%"
                    height="100%"
                    src="http://localhost:3001/test.html"
                    title="A custom made iframe"
                />
            </WorkspaceLayout>

        </Modal>
    );
}
