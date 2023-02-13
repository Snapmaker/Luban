import React from 'react';
import { Trans } from 'react-i18next';

import i18n from '../../../lib/i18n';
import modal, { FooterCheckBox, FooterPrimaryButton } from '../../../lib/modal';

const repairGuidePopup = () => {
    modal({
        isConfirm: true,
        title: i18n._('key-Modal/tips-Tips'),
        cancelTitle: 'key-Modal/Common-OK',
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

export const repairModelPopup = async (models) => {
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
