
export const shortcutActions = {
    // file actions
    'OPEN': Symbol('OPEN'),
    'SAVE': Symbol('SAVE'),
    'NEW': Symbol('NEW'),

    // editor actions
    'SELECTALL': Symbol('SELECTALL'),
    'UNSELECT': Symbol('UNSELECT'),
    'DELETE': Symbol('DELETE'),

    'CUT': Symbol('CUT'),
    'COPY': Symbol('COPY'),
    'PASTE': Symbol('PASTE'),
    'DUPLICATE': Symbol('DUPLICATE'),

    'UNDO': Symbol('UNDO'),
    'REDO': Symbol('REDO'),

    'IMPORT': Symbol('IMPORT'),
    'EXPORT_MODELS': Symbol('EXPORT_MODELS'),
    'EXPORT_GCODE': Symbol('EXPORT_GCODE'),

    'ENTER': Symbol('ENTER')
};

export const actionKeys = {
    [shortcutActions.OPEN]: ['mod+O'],
    [shortcutActions.SAVE]: ['mod+s'],
    [shortcutActions.SAVE_AS]: ['mod+shift+s'],
    [shortcutActions.NEW]: ['mod+n'],

    [shortcutActions.SELECTALL]: ['mod+a'],
    [shortcutActions.UNSELECT]: ['esc', 'mod+shift+a'],
    [shortcutActions.DELETE]: ['del', 'backspace'],
    [shortcutActions.COPY]: ['mod+c'],
    [shortcutActions.PASTE]: ['mod+v'],
    [shortcutActions.DUPLICATE]: ['mod+d'],
    [shortcutActions.CUT]: ['mod+x'],

    [shortcutActions.UNDO]: ['mod+z'],
    [shortcutActions.REDO]: ['mod+shift+z'],

    [shortcutActions.IMPORT]: ['mod+i'],
    [shortcutActions.EXPORT_MODELS]: ['mod+e'],
    [shortcutActions.EXPORT_GCODE]: ['mod+p'],

    [shortcutActions.ENTER]: ['enter']
};

export const priorities = {
    'APP': 0,
    'PAGE': 1,
    'VIEW': 2
};
