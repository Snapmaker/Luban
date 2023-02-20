module.exports = {
    rules: {
        'body-leading-blank': [1, 'always'],

        'footer-leading-blank': [1, 'always'],

        'header-max-length': [2, 'always', 100],
        'header-min-length': [2, 'always', 20],

        'subject-case': [
            2,
            'always',
            ['sentence-case', 'start-case', 'pascal-case', 'upper-case']
        ],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'subject-max-length': [2, 'always', 80],

        'type-case': [2, 'always', 'start-case'],
        'type-empty': [2, 'never'],
        'type-enum': [
            2,
            'always',
            [
                'Feature',
                'Improvement',
                'Fix',
                'Refactor',
                'Perf',
                'Test',
                'Build',
                'Chore',
                'Docs'
            ]
        ]
    }
};
