// const parser = require('github-actions-parser');
const yaml = require('js-yaml');
const child_process = require('child_process');
const fs = require('fs/promises');
const path = require('path');

function checkBashSyntax (script) {
    return new Promise((resolve, _reject) => {
        const child = child_process.execFile(
            'bash',
            ['-c', '-n', script],
            (_error, stdout, stderr) => {
                resolve({
                    exitCode: child.exitCode,
                    stdout,
                    stderr
                });
            }
        );
    });
}

async function checkWorkflow (filepath) {
    const filename = path.basename(filepath);
    let data = null;
    try {
        const rawFile = await fs.readFile(filepath, 'utf8');
        data = yaml.load(rawFile);
    }
    catch (error) {
        console.error(`✘ Could not parse ${filepath} as YAML`);
        return 1;
    }

    let code = 0;
    for (const [name, job] of Object.entries(data.jobs || {})) {
        const steps = job.steps || [];
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step.run) continue;

            const stepName = `${filename} job "${name}", step "${step.name || i}"`
            const shell = step.shell || 'bash';
            if (!shell.startsWith('bash')) {
                console.error(`? ${stepName}`);
                console.error(`  Cannot evaluate non-bash run steps (shell: "${shell}")`);
                continue;
            }

            const result = await checkBashSyntax(step.run);
            if (result.exitCode === 0) {
                console.error(`✔︎ ${stepName}`);
            }
            else {
                code = 1
                console.error(`✘ ERROR: ${stepName}`);
                for (let line of result.stderr.split('\n')) {
                    // Lines are prefixed with 'bash: -c: '
                    line = line.slice('bash: -c: '.length);
                    console.error(`  ${line}`);
                }
            }
        }
    }

    return code;
}

async function checkDirectory (directory) {
    console.error(`Validating workflows in ${directory}...`);
    let code = 0;
    const files = await fs.readdir(directory);
    for (const filename of files) {
        if (['.yaml', '.yml'].includes(path.extname(filename))) {
            const newCode = await checkWorkflow(path.join(directory, filename));
            code = code || newCode;
        }
    }
    return code;
}


const directory = process.argv[2] || '.github/workflows';
checkDirectory(directory)
    .then(code => process.exit(code))
    .catch(error => {
        console.error(error.toString());
        process.exit(1);
    });
