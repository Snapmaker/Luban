
export const shortcutActions = {
    // file actions
    'OPEN': Symbol('OPEN'),
    'SAVE': Symbol('SAVE'),
    'NEW': Symbol('NEW'),

    // editor actions
    'SELECTALL': Symbol('SELECTALL'),
    'UNSELECT': Symbol('UNSELECT'),
    'DELETE': Symbol('DELETE'),

    'COPY': Symbol('COPY'),
    'PASTE': Symbol('PASTE'),
    'DUPLICATE': Symbol('DUPLICATE'),

    'UNDO': Symbol('UNDO'),
    'REDO': Symbol('REDO')

};

export const actionKeys = {
    [shortcutActions.OPEN]: ['mod+O'],
    [shortcutActions.SAVE]: ['mod+s'],
    [shortcutActions.NEW]: ['mod+n'],

    [shortcutActions.SELECTALL]: ['mod+a'],
    [shortcutActions.UNSELECT]: ['esc'],
    [shortcutActions.DELETE]: ['del', 'backspace'],
    [shortcutActions.COPY]: ['mod+c'],
    [shortcutActions.PASTE]: ['mod+v'],
    [shortcutActions.DUPLICATE]: ['mod+d'],

    [shortcutActions.UNDO]: ['mod+z'],
    [shortcutActions.REDO]: ['mod+shift+z']
};

export const priorities = {
    'APP': 0,
    'PAGE': 1,
    'VIEW': 2
};
