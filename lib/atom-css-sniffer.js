'use babel';

let helpers;
let path;
let filesystem;

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
                const projectPath = atom.project.relativizePath(textEditor.getPath());

                loadDeps();

                if (!filesystem.existsSync(projectPath[0] + '/vendor/bin/css-sniff')) {
                    return null;
                }

                let args = ['--format=json', '--no-exit-code'];
                let env = {stdin: textEditor.getText()};

                return helpers.exec('vendor/bin/css-sniff', args, env).then(function (result) {
                    let data = JSON.parse(result);
                    let errors = [];

                    for (let i = 0; i < data.length; i++) {
                        errors.push({
                            severity: 'error',
                            location: {
                                file: editorPath,
                                position: [[data[i].line - 1, data[i].start], [data[i].line - 1, data[i].end]],
                            },
                            excerpt: data[i].msg,
                            description: data[i].msg
                        });
                    }

                    return errors;
                });
            }
        }
    }
};