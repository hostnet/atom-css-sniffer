'use babel';

let helpers;
let path;
let filesystem;

// Caches
let versions = {};
let commands = {}

/**
 * Load external dependencies.
 */
function loadDeps() {
    if (!helpers) {
        helpers = require('atom-linter');
    }
    if (!path) {
        path = require('path');
    }
    if (!filesystem) {
        filesystem = require('fs');
    }
}

/**
 * Return the command path to use for the project. this looks in the root of the
 * project and in the www folder. If none is found, null is returned.
 *
 * @param {string} projectPath
 * @return {string|null}
 */
function _getCommand(projectPath) {
    if (commands[projectPath]) {
        return commands[projectPath];
    }

    let commandPath = projectPath + '/vendor/bin/css-sniff';

    if (!filesystem.existsSync(commandPath)) {
        // do we have a WWW folder?
        commandPath = projectPath + '/www/vendor/bin/css-sniff';

        if (!filesystem.existsSync(commandPath)) {
            commandPath = null;
        }
    }

    return commands[projectPath] = commandPath;
}

/**
 * Return the standards file to use for this project.
 *
 * @param {string} projectPath
 * @return {string|null}
 */
function _getStandardsFile(projectPath) {
    let file = projectPath + '/csssniff.xml.dist';

    if (!filesystem.existsSync(file)) {
        // do we have a WWW folder?
        file = projectPath + '/www/csssniff.xml.dist';

        if (!filesystem.existsSync(file)) {
            return null;
        }
    }

    return file;
}

/**
 * Return a promise which resolves the current API version of the sniffer.
 *
 * The returned version is either null or a string.
 *
 * @param {string} projectPath
 * @param {string} command
 * @return {Promise}
 */
function _checkVersion(projectPath, command) {
    if (versions[projectPath]) {
        return versions[projectPath];
    }

    return versions[projectPath] = helpers.exec(command, ['--version']).then(function (result) {
        let matches = result.match(/v([0-9]\.[0-9])/);

        return matches === null ? '1.0' : matches[1];
    })
}

/**
 * Process the result for API version 2.0.
 *
 * @param {object} data
 * @param {string} editorPath
 * @return {array}
 */
function _processResultV2(data, editorPath) {
    let errors = [];

    for (let i in data.files) {
        if (!data.files.hasOwnProperty(i)) {
            continue;
        }

        let messages = data.files[i].messages;

        for (let j = 0; j < messages.length; j++) {
            errors.push({
                severity: 'error',
                location: {
                    file: editorPath,
                    position: [[messages[j].line - 1, messages[j].column - 1], [messages[j].line - 1, messages[j].column - 1]],
                },
                excerpt: messages[j].message,
                description: messages[j].message,
                linterName: messages[j].source
            });
        }
    }

    return errors;
}

/**
 * Process the result for API legacy version.
 *
 * @param {object} data
 * @param {string} editorPath
 * @return {array}
 */
function _processResultLegacy(data, editorPath) {
    let errors = [];

    for (let i = 0; i < data.length; i++) {
        errors.push({
            severity: 'error',
            location: {
                file: editorPath,
                position: [[data[i].line - 1, data[i].start], [data[i].line - 1, Math.max(-1, data[i].end - 1)]],
            },
            excerpt: data[i].msg,
            description: data[i].msg
        });
    }

    return errors;
}

export default {
    activate(state) {},

    deactivate() {},

    provideLinter() {
        return {
            name: 'CSS & LESS linter',
            scope: 'file',
            lintsOnChange: true,
            grammarScopes: ['source.css', 'source.css.less'],

            lint(textEditor) {
                const editorPath = textEditor.getPath();
                const editorFile = textEditor.getTitle();
                const projectPath = atom.project.relativizePath(editorPath);

                loadDeps();

                let cmd = _getCommand(projectPath[0]);

                if (cmd === null) {
                    return null;
                }

                return _checkVersion(projectPath[0], cmd).then(function (version) {
                    let args = ['sniff', '--format=json', '--no-exit-code'];

                    if (version === '2.0') {
                        args.push('--stdin');

                        // Add the correct standards file
                        let standard = _getStandardsFile(projectPath[0]);

                        if (null !== standard) {
                            args.push('--standard=' + standard);
                        }

                        // Add the file for any matching rules
                        if (editorFile !== 'untitled') {
                            args.push(editorPath);
                        }
                    }

                    let env = {stdin: textEditor.getText()};

                    return helpers.exec(cmd, args, env).then(function (result) {
                        let data = JSON.parse(result);

                        if (null === data) {
                            return null;
                        }

                        switch (version) {
                            case '2.0':
                                return _processResultV2(data, editorPath);
                            default:
                                return _processResultLegacy(data, editorPath);
                        }
                    });
                });
            }
        }
    }
};
