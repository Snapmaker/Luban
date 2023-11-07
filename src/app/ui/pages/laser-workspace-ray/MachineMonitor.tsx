import React, { useEffect } from 'react';
import SocketEvent from '../../../communication/socket-events';

import { controller } from '../../../communication/socket-communication';
import { getErrorReportReason } from '../../../constants/machines';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import modal from '../../../lib/modal';


const MachineMonitor: React.FC = () => {
    useEffect(() => {
        const eventHandlers = {
            [SocketEvent.ErrorReport]: (options) => {
                const { owner, errorCode } = options;

                log.warn(`Receiving machine error report: owner=${owner}, error code=${errorCode}`);

                const reason = getErrorReportReason(owner, errorCode);

                if (reason) {
                    modal({
                        title: i18n._('key-Workspace/Page-Warning'),
                        body: reason,
                        isConfirm: true,
                    });
                } else {
                    switch (owner) {
                        // Ray controller
                        case 2051: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs on the Ray controller, error code: {{-errorCode}}', { errorCode }),
                                isConfirm: true,
                            });
                            break;
                        }

                        // Laser modules: 1.6W, 10W, 20W, 40W
                        case 2:
                        case 14:
                        case 19:
                        case 20: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs on the laser module, error code: {{-errorCode}}', { errorCode }),
                                isConfirm: true,
                            });
                            break;
                        }

                        // Enclosure
                        case 16: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs on the enclosure, error code: {{-errorCode}}', { errorCode }),
                                isConfirm: true,
                            });
                            break;
                        }

                        // Air purifier
                        case 7: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs on the air purifier, error code: {{-errorCode}}', { errorCode }),
                                isConfirm: true,
                            });
                            break;
                        }

                        // Emergency stop button
                        case 517: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Emergency stop button triggered'),
                                isConfirm: true,
                            });
                            break;
                        }

                        // Ray Multi-Function Button
                        case 520: {
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs on the Ray multi-function button, error code: {{-errorCode}}', { errorCode }),
                                isConfirm: true,
                            });
                            break;
                        }

                        default:
                            modal({
                                title: i18n._('key-Workspace/Page-Warning'),
                                body: i18n._('Error occurs owner: {{-owner}}, error code: {{-errorCode}}', { owner, errorCode }),
                                isConfirm: true,
                            });
                            break;
                    }
                }
            },
        };

        Object.keys(eventHandlers).forEach(eventName => {
            const callback = eventHandlers[eventName];
            controller.on(eventName, callback);
        });

        return () => {
            Object.keys(eventHandlers).forEach(eventName => {
                const callback = eventHandlers[eventName];
                controller.off(eventName, callback);
            });
        };
    }, []);

    return (<div />);
};

export default MachineMonitor;
