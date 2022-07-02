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
