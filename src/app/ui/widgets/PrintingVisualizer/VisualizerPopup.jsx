import React from 'react';
import { Trans } from 'react-i18next';
import modal, { FooterCheckBox, FooterPrimaryButton } from '../../../lib/modal';
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

export const repairModelFailPopup = (models, onClose) => {
    const modelNames = models.map((c) => {
        return c.originalName;
    }).join();
    return modal({
        cancelTitle: i18n._(''),
        title: i18n._('key-Printing/ContextMenu-Repair Error'),
        body: (
            <React.Fragment>
                <p>{i18n._('Failed to repair this object. \n')}</p>
                <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {modelNames}</p>
            </React.Fragment>
        )
    }).close(() => {
        onClose();
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
            title: i18n._('key-Modal/tips-Tips'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-Printing/ContextMenu-BeforSimplify Model need to repair damage model')}   </p>
                </React.Fragment>
            ),
            footer: (
                <FooterPrimaryButton
                    i18nKey="key-3DP/MainToolBar-Model repair"
                    onClick={() => {
                        resolve();
                        action.close();
                    }}
                />
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
        title: i18n._('key-Modal/tips-Tips'),
        body: (
            <React.Fragment>
                <Trans i18nKey="key-Modal/tips-To repair deficient models, you can also click Repair in the top main toolbar.">
                    To repair deficient models, you can also click <b>Repair</b> in the top main toolbar.
                </Trans>
                <Trans i18nKey="key-Modal/tips-To enable the pop-up reminder of  Repair Model(s), go to Settings > Preferences > General.">
                    To enable the pop-up reminder of <b>Repair Model(s)</b>, go to <b>Settings</b> <b>Preferences</b>  <b>  General</b>
                </Trans>
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
            title: i18n._('key-Modal/Repair-Repair Model(s)'),
            body: (
                <React.Fragment>
                    <p>{i18n._('key-Modal/Repair-Errors are detected in the imported model(s), which may cause problems during machining. Do you want to repair the model(s)?')}   </p>
                    <p>{i18n._('key-Modal/Repair-Model(s) with Errors')}: {modelNames}</p>
                </React.Fragment>
            ),
            showChangeIgnore: true,
            cancelTitle: 'key-Modal/Common-Ignore',
            footer: (
                <FooterPrimaryButton
                    i18nKey="key-Printing/Repair"
                    onClick={() => {
                        resolve(ignore);
                        action.close();
                    }}
                />
            ),
            footerLeft: (
                <FooterCheckBox
                    i18nKey="key-Modal/Common-Do not ask me again"
                    onChange={(bool) => {
                        if (bool) {
                            repairGuidePopup();
                        }
                        ignore = bool;
                    }}
                />
            ),
            onClose: () => {
                reject(ignore);
            }
        });
    });
};
