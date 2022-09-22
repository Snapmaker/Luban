import React from 'react';
import i18next from 'i18next';
import Modal from '../components/Modal/tileModal';
import CustomIframe from '../CustomIframe';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import MainToolBar from '../layouts/MainToolBar';
// import i18n from '../../lib/i18n';

export default function renderCustomIframe(options) {
    const { onClose, visible = true } = options;


    if (!onClose) {
        console.error('Popup need close action');
    }
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
                    src="http://localhost:3000/test.html"
                    title="A custom made iframe"
                />
            </WorkspaceLayout>

        </Modal>
    );
}
