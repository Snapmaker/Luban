import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { actions as printingActions } from '../../../../flux/printing';
import type { ShortcutHandler } from '../../../../lib/shortcut';
import { ShortcutHandlerPriority, ShortcutManager, PREDEFINED_SHORTCUT_ACTIONS } from '../../../../lib/shortcut';

/**
 * Add shortcut bindings to the scene.
 */
const SceneShortcuts: React.FC = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const handler: ShortcutHandler = {
            title: 'SceneView',
            isActive: () => {
                return dispatch(printingActions.isShortcutActive()) as unknown as boolean;
            },

            priority: ShortcutHandlerPriority.View,

            shortcuts: {
                // select
                [PREDEFINED_SHORTCUT_ACTIONS.SELECTALL]: () => dispatch(printingActions.selectAllModels()),
                [PREDEFINED_SHORTCUT_ACTIONS.UNSELECT]: () => dispatch(printingActions.unselectAllModels()),
                [PREDEFINED_SHORTCUT_ACTIONS.DELETE]: () => dispatch(printingActions.removeSelectedModel()),

                // copy/paste
                [PREDEFINED_SHORTCUT_ACTIONS.COPY]: () => dispatch(printingActions.copy()),
                [PREDEFINED_SHORTCUT_ACTIONS.CUT]: () => dispatch(printingActions.cut()),
                [PREDEFINED_SHORTCUT_ACTIONS.PASTE]: () => dispatch(printingActions.paste()),
                [PREDEFINED_SHORTCUT_ACTIONS.DUPLICATE]: () => dispatch(printingActions.duplicateSelectedModel()),

                // undo/redo
                [PREDEFINED_SHORTCUT_ACTIONS.UNDO]: () => dispatch(printingActions.undo()),
                [PREDEFINED_SHORTCUT_ACTIONS.REDO]: () => dispatch(printingActions.redo()),

                // preview
                'SHOWGCODELAYERS_ADD': {
                    keys: ['alt+up'],
                    callback: () => {
                        dispatch(printingActions.offsetGcodeLayers(1));
                    },
                },
                'SHOWGCODELAYERS_MINUS': {
                    keys: ['alt+down'],
                    callback: () => {
                        dispatch(printingActions.offsetGcodeLayers(-1));
                    }
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

export default SceneShortcuts;
