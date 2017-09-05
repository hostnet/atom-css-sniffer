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

                let cmd = projectPath[0] + '/vendor/bin/css-sniff';

                if (!filesystem.existsSync(cmd)) {
                    // do we have a WWW folder?
                    cmd = projectPath[0] + '/www/vendor/bin/css-sniff';

                    if (!filesystem.existsSync(cmd)) {
                        return null;
                    }
                }

                let args = ['--format=json', '--no-exit-code'];
                let env = {stdin: textEditor.getText()};

                return helpers.exec(cmd, args, env).then(function (result) {
                    let data = JSON.parse(result);

                    if (null === data) {
                      return null;
                    }

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
                });
            }
        }
    }
};
