import React from 'react';
import i18next from 'i18next';
import Modal from '../components/Modal/tileModal';
import CustomIframe from '../CustomIframe';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import MainToolBar from '../layouts/MainToolBar';
// import i18n from '../../lib/i18n';

function renderCustomIframe(options) {
    const { onClose, showDownloadPopup, visible } = options;

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
    // src="http://localhost:3000/test.html"

    return (
        <Modal
            closable={false}
            disableOverlay
            zIndex={1002}
            tile
            visible={visible}
            onClose={onClose}
        >

            <WorkspaceLayout
                renderMainToolBar={renderMainToolBar}
                pureCss
            >
                <CustomIframe
                    allow="fullscreen"
                    style={{ border: 'solid #D5D6D9', borderWidth: '1px 0 0', backgroundColor: 'white' }}
                    width="100%"
                    height="100%"
                    src="http://172.18.0.49:8085/resource-list?client=Luban"
                    title="A custom made iframe"
                />
            </WorkspaceLayout>

        </Modal>
    );
}
export default renderCustomIframe;
