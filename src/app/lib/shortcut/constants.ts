
export const PREDEFINED_SHORTCUT_ACTIONS = {
    // file actions
    'OPEN': Symbol('OPEN'),
    'SAVE': Symbol('SAVE'),
    'SAVE_AS': Symbol('SAVE_AS'),
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

    'ENTER': Symbol('ENTER'),
};

export const PREDEFINED_SHORTCUT_KEYS = {
    [PREDEFINED_SHORTCUT_ACTIONS.OPEN]: ['mod+O'],
    [PREDEFINED_SHORTCUT_ACTIONS.SAVE]: ['mod+s'],
    [PREDEFINED_SHORTCUT_ACTIONS.SAVE_AS]: ['mod+shift+s'],
    [PREDEFINED_SHORTCUT_ACTIONS.NEW]: ['mod+n'],

    [PREDEFINED_SHORTCUT_ACTIONS.SELECTALL]: ['mod+a'],
    [PREDEFINED_SHORTCUT_ACTIONS.UNSELECT]: ['esc', 'mod+shift+a'],
    [PREDEFINED_SHORTCUT_ACTIONS.DELETE]: ['del', 'backspace'],
    [PREDEFINED_SHORTCUT_ACTIONS.COPY]: ['mod+c'],
    [PREDEFINED_SHORTCUT_ACTIONS.PASTE]: ['mod+v'],
    [PREDEFINED_SHORTCUT_ACTIONS.DUPLICATE]: ['mod+d'],
    [PREDEFINED_SHORTCUT_ACTIONS.CUT]: ['mod+x'],

    [PREDEFINED_SHORTCUT_ACTIONS.UNDO]: ['mod+z'],
    [PREDEFINED_SHORTCUT_ACTIONS.REDO]: ['mod+shift+z'],

    [PREDEFINED_SHORTCUT_ACTIONS.IMPORT]: ['mod+i'],
    [PREDEFINED_SHORTCUT_ACTIONS.EXPORT_MODELS]: ['mod+e'],
    [PREDEFINED_SHORTCUT_ACTIONS.EXPORT_GCODE]: ['mod+p'],

    [PREDEFINED_SHORTCUT_ACTIONS.ENTER]: ['enter']
};
