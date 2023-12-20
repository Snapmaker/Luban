
import { useDispatch } from 'react-redux';
import React, { useEffect } from 'react';
import type { ShortcutHandler } from '../../../../lib/shortcut';
import {
    ShortcutHandlerPriority,
    ShortcutManager
} from '../../../../lib/shortcut';

interface MoveOptions {
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
}

interface JogPadShortcutProps {
    // whether enable B axis control
    // enableBAxis?: boolean;

    // jog buttons are disabled
    disabled?: boolean;
    relativeMove: (moveOptions: MoveOptions) => void;
    // absoluteMove: (moveOptions: MoveOptions) => void;
}

/**
 * Add shortcut bindings to the scene.
 */
const JogPadShortcut: React.FC<JogPadShortcutProps> = (props) => {
    const dispatch = useDispatch();
    const {
        disabled = false,
        // enableBAxis = false,
        relativeMove,
    } = props;

    useEffect(() => {
        const handler: ShortcutHandler = {
            title: 'AB-Position',
            priority: ShortcutHandlerPriority.Widget,
            isActive: () => {
                return true;
            },
            shortcuts: {
                // control
                'ArrowUp': {
                    keys: ['up'],
                    callback: () => {
                        !disabled && relativeMove({ Y: 1 });
                    }
                },
                'ArrowDown': {
                    keys: ['down'],
                    callback: () => !disabled && relativeMove({ Y: -1 })
                },
                'ArrowLeft': {
                    keys: ['left'],
                    callback: () => !disabled && relativeMove({ X: -1 })
                },
                'ArrowRight': {
                    keys: ['right'],
                    callback: () => !disabled && relativeMove({ X: 1 })
                }
            },
        };

        ShortcutManager.register(handler);

        return () => {
            ShortcutManager.unregister(handler);
        };
    }, [dispatch]);

    return (<div />);
};

export default JogPadShortcut;
