import React from 'react';
import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';

export const loadModelFailPopup = (fileName) => {
    return modal({
        cancelTitle: i18n._(''),
        title: i18n._('key-Printing/ContextMenu-Import Error'),
        body: (
            <React.Fragment>
                <p>{i18n._('Failed to import this object. \nPlease select a supported file format.')}</p>
                <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {fileName}</p>
            </React.Fragment>
        )
    });
};

export const repairModelFailPopup = (fileName) => {
    return modal({
        cancelTitle: i18n._(''),
        title: i18n._('key-Printing/ContextMenu-Repair Error'),
        body: (
            <React.Fragment>
                <p>{i18n._('Failed to repair this object. \n')}</p>
                <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {fileName}</p>
            </React.Fragment>
        )
    });
};

export const scaletoFitPopup = (model) => {
    return new Promise((resolve, reject) => {
        const action = modal({
            title: i18n._('key-Printing/ContextMenu-Scale to Fit'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-Printing/ContextMenu-Model size has exceeded the printable area.')}</p>
                    <p>{i18n._('key-Printing/ContextMenu-Scale it to the maximum printable size?')}</p>
                    <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {model.modelName}</p>
                </React.Fragment>
            ),

            footer: (
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    className="margin-left-4"
                    onClick={() => {
                        resolve();
                        action.close();
                    }}
                >
                    {i18n._('key-Printing/ContextMenu-Scale')}
                </Button>
            ),

            onClose: () => {
                reject();
            }
        });
    });
};


export const sliceFailPopup = () => {
    return modal({
        cancelTitle: i18n._(''),
        title: i18n._('key-Progress/3DP-Slice Failed'),
        body: (
            <React.Fragment>
                <p>{i18n._('key-Progress/3DP-Slice Failed reason')}</p>
            </React.Fragment>
        )
    });
};

export const repairModelBeforSimplifyPopup = () => {
    return new Promise((resolve, reject) => {
        const action = modal({
            title: i18n._('key-Printing/ContextMenu-Repair model'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-Printing/ContextMenu-BeforSimplify Model need to repair damage model')}   </p>
                </React.Fragment>
            ),
            footer: (
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    className="margin-left-4"
                    onClick={() => {
                        resolve();
                        action.close();
                    }}
                >
                    {i18n._('key-Printing/ContextMenu-Repair model')}
                </Button>
            ),

            onClose: () => {
                reject();
            }
        });
    });
};

export const repairGuidePopup = () => {
    modal({
        isConfirm: true,
        title: i18n._('key-Printing/ContextMenu-Tips'),
        body: (
            <React.Fragment>
                <p>{i18n._('key-Printing/ContextMenu-you can click the "repair model" button on the toolbar to repair it manually or reopen the model detection pop-up window in "Settings"，when you import error models next time')}   </p>
            </React.Fragment>
        )
    });
};

export const repairModelPopup = (models) => {
    let ignore = false;
    const modelNames = models.map((c) => {
        return c.modelName;
    }).join();
    return new Promise((resolve, reject) => {
        const action = modal({
            title: i18n._('key-Printing/ContextMenu-Repair model'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-Printing/ContextMenu-Model repair prompt message')}   </p>
                    <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {modelNames}</p>
                </React.Fragment>
            ),
            showChangeIgnore: true,
            cancelTitle: '忽略',
            footer: (
                <Button
                    priority="level-two"
                    type="primary"
                    width="96px"
                    className="margin-left-4"
                    onClick={() => {
                        resolve(ignore);
                        action.close();
                    }}
                >
                    {i18n._('key-Printing/ContextMenu-Repair model')}
                </Button>
            ),
            onChangeIgnore: (bool) => {
                if (bool) {
                    repairGuidePopup();
                }
                ignore = bool;
            },
            onClose: () => {
                reject(ignore);
            }
        });
    });
};
