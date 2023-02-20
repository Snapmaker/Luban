const _ = require('lodash');
const wrap = require('word-wrap');
const commitizen = require('commitizen');

function createQuestions(config) {
    config.maxSubjectLength = config.maxSubjectLength || 80;

    const types = [
        {
            name: 'Feature',
            description: 'A new feature'
        },
        {
            name: 'Improvement',
            description: 'An improvement to a current feature'
        },
        {
            name: 'Fix',
            description: 'A bug fix'
        },
        {
            name: 'Refactor',
            description: 'A code change that neither fixes a bug nor adds a feature'
        },
        {
            name: 'Perf',
            description: 'A code change that improves performance'
        },
        {
            name: 'Test',
            description: 'Adding missing tests or correcting existing tests'
        },
        {
            name: 'Build',
            description: 'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)'
        },
        {
            name: 'Chore',
            description: 'Changes that do not affect the meaning of the code (package.json, white-space, formatting, etc)'
        },
        {
            name: 'Docs',
            description: 'Documentation only changes'
        }
    ];

    const length = 15;
    const choices = _.map(types, (type) => ({
        name: `${_.padEnd(`${type.name}:`, length)} ${type.description}`,
        value: type.name
    }));

    return [
        {
            type: 'list',
            name: 'type',
            message: "Select the type of change that you're committing:",
            choices
        },
        {
            type: 'input',
            name: 'subject',
            message: `Write a short, imperative tense description of the change (max header length: ${config.maxSubjectLength}):\n`
        },
        {
            type: 'input',
            name: 'body',
            message: 'Provide a longer description of the change:\n'
        },
        {
            type: 'input',
            name: 'issues',
            message: 'List any issues closed by this change:\n'
        }
    ];
}

/**
 * Format the git commit message from given answers.
 *
 * @param {Object} answers Answers provide user
 * @param {Object} config Config specified in package.json
 *
 * @return {String} Formatted git commit message
 */
function format(answers, config) {
    config.bodyLineLength = config.bodyLineLength || 80;

    const wrapOptions = {
        trim: true,
        newline: '\n',
        indent: '',
        cut: true,
        width: config.bodyLineLength,
    };

    const head = answers.type + ': ' + answers.subject.trim();
    const body = wrap(answers.body, wrapOptions);
    const footer = answers.issues
        ? 'Closes ' + (answers.issues.match(/#\d+/g) || []).join(', closes')
        : '';

    return [head, body, footer].filter(x => x).join('\n\n');
}

module.exports = {
    prompter: (cz, commit) => {
        const config = commitizen.configLoader.load();
        cz.prompt(createQuestions(config))
            .then(answers => format(answers, config))
            .then(commit);
    }
};
