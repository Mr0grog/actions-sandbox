"Check syntax of workflow run steps using bash in all workflows."
from pathlib import Path
import re
from subprocess import run
import sys
import yaml
from yaml import CLoader as Loader

def check_workflow(filepath):
    with filepath.open() as file:
        data = yaml.load(file, Loader=yaml.CLoader)

    exit_code = 0
    for name, job in data.get('jobs', {}).items():
        for index, step in enumerate(job.get('steps', [])):
            if 'run' not in step:
                continue
            
            step_name = f'{filepath.name} job "{name}", step "{step.get("name", index)}"'
            if not step.get('shell', 'bash').startswith('bash'):
                print(f'? {step_name}')
                print(f'  Cannot evaluate non-bash run steps (shell: "{step["shell"]}")')
                continue
            
            result = run(['bash', '-c', '-n', step['run']], capture_output=True)
            if result.returncode == 0:
                print(f'✔︎ {step_name}')
            if result.returncode > 0:
                exit_code = 1
                print(f'✘ ERROR: {step_name}')
                for line in result.stderr.decode().split('\n'):
                    line = line.partition('-c: ')[2] or line
                    print(f'  {line}')
    
    return exit_code

exit_code = 0
for child in Path('./.github/workflows/').iterdir():
    if child.suffix == '.yaml' or child.suffix == '.yml':
        exit_code = check_workflow(child) or exit_code

sys.exit(exit_code)
