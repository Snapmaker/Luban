import i18n from './i18n';

export default (word) => {
    const wordText = {
        // Motion
        'G0': i18n._('Rapid Move (G0)', { ns: 'gcode' }),
        'G1': i18n._('Linear Move (G1)', { ns: 'gcode' }),

        // Units
        'G20': i18n._('Inches (G20)', { ns: 'gcode' }),
        'G21': i18n._('Millimeters (G21)', { ns: 'gcode' }),

        // Distance
        'G90': i18n._('Absolute (G90)', { ns: 'gcode' }),
        'G91': i18n._('Relative (G91)', { ns: 'gcode' }),

        // Feed Rate
        'G93': i18n._('Inverse Time (G93)', { ns: 'gcode' }),
        'G94': i18n._('Units/Min (G94)', { ns: 'gcode' }),

        // Spindle
        'M3': i18n._('Spindle On, CW (M3)', { ns: 'gcode' }),
        'M4': i18n._('Spindle On, CCW (M4)', { ns: 'gcode' }),
        'M5': i18n._('Spindle Off (M5)', { ns: 'gcode' })
    };

    return (wordText[word] || word);
};
