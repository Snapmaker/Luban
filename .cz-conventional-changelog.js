const _ = require('lodash');
const commitizen = require('commitizen');

function createQuestions(config) {
    config.maxSubjectLength = config.maxSubjectLength || 80;

    const types = [
        {
            name: 'feature',
            description: 'A new feature'
        },
        {
            name: 'improvement',
            description: 'An improvement to a current feature'
        },
        {
            name: 'fix',
            description: 'A bug fix'
        },
        {
            name: 'refactor',
            description: 'A code change that neither fixes a bug nor adds a feature'
        },
        {
            name: 'perf',
            description: 'A code change that improves performance'
        },
        {
            name: 'test',
            description: 'Adding missing tests or correcting existing tests'
        },
        {
            name: 'build',
            description: 'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)'
        },
        {
            name: 'style',
            description: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)'
        },
        {
            name: 'docs',
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
            name: 'breaking',
            message: 'List any breaking changes:\n'
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
 * @param {Object} answers Answers provide by `inquier.js`
 * @return {String} Formated git commit message
 */
function format(answers) {
    const issues = answers.issues
        ? 'Closes ' + (answers.issues.match(/#\d+/g) || []).join(', closes')
        : '';

    const head = answers.type + ' ' + answers.subject.trim();
    const body = wrap();
}

module.exports = {
    prompter: (cz, commit) => {
        const config = commitizen.configLoader.load();
        cz.prompt(createQuestions(config))
            .then(format)
            .then(commit);
    }
};
