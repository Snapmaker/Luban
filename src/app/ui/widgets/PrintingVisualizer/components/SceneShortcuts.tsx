import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { actions as printingActions } from '../../../../flux/printing';
import { priorities, shortcutActions, ShortcutManager } from '../../../../lib/shortcut';

/**
 * Add shortcut bindings to the scene.
 */
const SceneShortcuts: React.FC = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const handler = {
            title: 'SceneView',
            isActive: () => {
                return dispatch(printingActions.isShortcutActive());
            },

            priority: priorities.VIEW,

            shortcuts: {
                // select
                [shortcutActions.SELECTALL]: () => dispatch(printingActions.selectAllModels()),
                [shortcutActions.UNSELECT]: () => dispatch(printingActions.unselectAllModels()),
                [shortcutActions.DELETE]: () => dispatch(printingActions.removeSelectedModel()),

                // copy/paste
                [shortcutActions.COPY]: () => dispatch(printingActions.copy()),
                [shortcutActions.CUT]: () => dispatch(printingActions.cut()),
                [shortcutActions.PASTE]: () => dispatch(printingActions.paste()),
                [shortcutActions.DUPLICATE]: () => dispatch(printingActions.duplicateSelectedModel()),

                // undo/redo
                [shortcutActions.UNDO]: () => dispatch(printingActions.undo()),
                [shortcutActions.REDO]: () => dispatch(printingActions.redo()),

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

        console.error('register');
        ShortcutManager.register(handler);

        return () => {
            // TOOD: unregister shortcuts?
            console.error('unregister');
        };
    }, [dispatch]);

    return (<div />);
};

export default SceneShortcuts;
