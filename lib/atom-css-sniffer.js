'use babel';

let helpers;
let path;
let filesystem;

// Caches
let versions = {};
let cmds = {}

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

function _getCommand(projectPath) {
    if (cmds[projectPath]) {
        return cmds[projectPath];
    }

    let cmd = projectPath + '/vendor/bin/css-sniff';

    if (!filesystem.existsSync(cmd)) {
        // do we have a WWW folder?
        cmd = projectPath + '/www/vendor/bin/css-sniff';

        if (!filesystem.existsSync(cmd)) {
            cmd = null;
        }
    }

    return cmds[projectPath] = cmd;
}

function _checkVersion(projectPath, cmd) {
    if (versions[projectPath]) {
        return versions[projectPath];
    }

    return versions[projectPath] = helpers.exec(cmd, ['--version'], {}).then(function (result) {
        let matches = result.match(/v([0-9]\.[0-9])/);

        return matches === null ? '1.0' : matches[1];
    })
}

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

                        // Add the file for any matching rules
                        if (editorFile !== 'untitled') {
                            args.push(editorPath + '/' + editorFile);
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
