import React, { useState } from 'react';

import i18n from '../../../../lib/i18n';
import modal from '../../../../lib/modal';
import { Button } from '../../../components/Buttons';
import Switch from '../../../components/Switch';

interface BodyProps {
    message?: string;
    checkboxLabel: string;
    defaultChecked: boolean;
    onChange: (checked: boolean) => void;
}

const Body: React.FC<BodyProps> = ({ message, checkboxLabel, defaultChecked, onChange }) => {
    const [checked, setChecked] = useState(defaultChecked);
    return (
        <div>
            {message && <div className="margin-bottom-16">{message}</div>}
            <div className="sm-flex justify-space-between align-center">
                <span className="text-overflow-ellipsis margin-right-8">{checkboxLabel}</span>
                <Switch
                    className="sm-flex-auto"
                    checked={checked}
                    onClick={() => {
                        const next = !checked;
                        setChecked(next);
                        onChange(next);
                    }}
                />
            </div>
        </div>
    );
};

interface ConfirmWithCheckboxOptions {
    title: string;
    message?: string;
    checkboxLabel: string;
    defaultChecked?: boolean;
    confirmText?: string;
    onConfirm: (checked: boolean) => void;
}

/**
 * Show a confirmation modal with a single toggle inside it. The toggle's value is passed to
 * onConfirm only when the user presses Confirm; pressing Cancel (the modal's default button) does
 * nothing. Used so motion actions (Home, Go To Work Origin) always require a deliberate confirm,
 * carrying their option (fast homing / diagonal move) in the modal rather than as an inline toggle.
 */
export function showConfirmWithCheckbox(options: ConfirmWithCheckboxOptions): void {
    const { title, message, checkboxLabel, defaultChecked = false, confirmText, onConfirm } = options;
    let chosen = defaultChecked;
    const popup = modal({
        title,
        body: (
            <Body
                message={message}
                checkboxLabel={checkboxLabel}
                defaultChecked={defaultChecked}
                onChange={(v) => { chosen = v; }}
            />
        ),
        footer: (
            <Button
                priority="level-two"
                type="primary"
                width="96px"
                onClick={() => { popup.close(); onConfirm(chosen); }}
            >
                {confirmText || i18n._('key-Modal/Common-Confirm')}
            </Button>
        ),
    });
}

export default showConfirmWithCheckbox;
