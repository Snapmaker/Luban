#!/usr/bin/env python3
"""Generate a copyable MCP tool list from the release's registered tool definitions.

The source scanner deliberately fails on registration syntax it cannot understand,
so a newly introduced tool cannot silently disappear from release documentation.
"""

import argparse
import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL_DIR = ROOT / 'src/server/services/mcp/tools'
BEGIN = '<!-- BEGIN GENERATED MCP TOOLING -->'
END = '<!-- END GENERATED MCP TOOLING -->'
STRING = r"'(?:\\.|[^'\\])*'"
REGISTER = re.compile(
    rf'registry\.register\(\{{\s*name(?::\s*(?P<name>{STRING}))?\s*,\s*description:\s*',
    re.S,
)
LITERAL = re.compile(STRING + r'|`(?:\\.|[^`\\])*`', re.S)

CATEGORIES = [
    'Status and connection',
    'G-code jobs',
    'Transport and direct motion',
    'Camera and vision',
    'Camera model',
    'Landmarks',
    'Probe feed',
    'Tool setter and tool change',
    'Touch-probe procedures',
    'CAM probing programs',
    'Workspaces and origins',
]
FILE_CATEGORY = {
    'status.ts': 'Status and connection',
    'machine.ts': 'Status and connection',
    'gcode.ts': 'G-code jobs',
    'threadMilling.ts': 'G-code jobs',
    'camera.ts': 'Camera and vision',
    'cameraModel.ts': 'Camera model',
    'calibration.ts': 'Camera model',
    'landmarks.ts': 'Landmarks',
    'probe.ts': 'Probe feed',
    'toolsetter.ts': 'Tool setter and tool change',
    'probing.ts': 'Touch-probe procedures',
    'cam.ts': 'CAM probing programs',
    'workspace.ts': 'Workspaces and origins',
}
SHORT_OVERRIDES = {
    'get_gcode_job_status': 'Report a job state, ending reason, events, results, and live machine progress.',
    'visual_servo': 'Use the stored camera calibration to move toward a target pixel and capture a new frame.',
    'probe_stock_outline': 'Stage a probe circuit to find a block top, outline, and centre from an estimated location.',
    'run_probing_gcode': 'Stage a CAM probing program for one operator approval and return an inspection report.',
}
CATEGORY_OVERRIDES = {
    'move_z': 'Transport and direct motion',
    'traverse_xy': 'Transport and direct motion',
    'home': 'Transport and direct motion',
    'goto_work_origin': 'Transport and direct motion',
    'move_and_capture': 'Transport and direct motion',
    'restore_work_frame': 'Transport and direct motion',
    'visual_servo': 'Camera and vision',
}


def string_values(expression: str) -> str:
    matches = list(LITERAL.finditer(expression))
    remainder = LITERAL.sub('', expression)
    if not matches or re.sub(r'[+\s]', '', remainder):
        raise ValueError(f'Unsupported description expression: {expression[:120]!r}')
    return ''.join(
        re.sub(r'\$\{[^}]+\}', '<value>', match.group()[1:-1]) if match.group().startswith('`')
        else ast.literal_eval(match.group())
        for match in matches
    )


def brief(description: str) -> str:
    compact = ' '.join(description.split())
    first = re.split(r'(?<!e.g)(?<!i.e)\.\s+(?=[A-Za-z])', compact, maxsplit=1)[0]
    if len(first) > 180:
        # Descriptions are deliberately detailed for agents. A short first
        # clause gives the public list a useful action summary without
        # exposing an arbitrary, half-finished fragment.
        boundaries = [first.find(mark, 45) for mark in (': ', ' (', ' - ', ', ', '; ')]
        boundaries = [index for index in boundaries if 45 <= index <= 180]
        if boundaries:
            first = first[:min(boundaries)]
        else:
            words = first.split()
            first = ' '.join(words[:18])
    return first.rstrip(' ,;:.') + '.'


def collect_tools():
    tools = []
    files = sorted(TOOL_DIR.glob('*.ts'))
    for path in files:
        source = path.read_text()
        registrations = list(REGISTER.finditer(source))
        if source.count('registry.register({') != len(registrations):
            raise ValueError(f'Unrecognized registration in {path}')
        if not registrations:
            continue
        if path.name not in FILE_CATEGORY:
            raise ValueError(f'No category for {path}')
        for match in registrations:
            end = re.search(r',\s*inputSchema\s*:', source[match.end():], re.S)
            if end is None:
                raise ValueError(f'No inputSchema after registration in {path}')
            expression = source[match.end():match.end() + end.start()].strip()
            raw_name = match.group('name')
            if raw_name is None:
                # The workspace registration loop generates two names and two
                # descriptions. Require its exact shape before expanding it.
                if path.name != 'workspace.ts':
                    raise ValueError(f'Unsupported dynamic name in {path}')
                names = re.search(rf'const name = write \? ({STRING}) : ({STRING});', source)
                descriptions = re.search(rf'\?\s*({STRING})\s*:\s*({STRING})', expression, re.S)
                if not names or not descriptions:
                    raise ValueError('Workspace registration changed; update the generator')
                for name_literal, description_literal in zip(names.groups(), descriptions.groups()):
                    tools.append((ast.literal_eval(name_literal), brief(ast.literal_eval(description_literal)), FILE_CATEGORY[path.name]))
            else:
                name = ast.literal_eval(raw_name)
                category = CATEGORY_OVERRIDES.get(name, FILE_CATEGORY[path.name])
                tools.append((name, brief(string_values(expression)), category))
    names = [name for name, _, _ in tools]
    if len(names) != len(set(names)):
        raise ValueError('Duplicate MCP tool names in source')
    return tools


def render(tag: str, tools, repository: str) -> str:
    lines = [
        f'# Luban MCP tools — {tag}',
        '',
        f'Terse reference for the {len(tools)} MCP tools in `{tag}`. Start a fresh session with `get_stored_state`. '
        'Read the CNC skills and MCP setup guide for operating rules. Staged jobs require operator approval through '
        'the confirmation page; direct tools follow their documented guards.',
        '',
    ]
    for category in CATEGORIES:
        entries = [(name, description) for name, description, group in tools if group == category]
        if entries:
            lines += [f'## {category}', '']
            lines += [f'- `{name}` — {SHORT_OVERRIDES.get(name, description)}' for name, description in entries]
            lines.append('')
    lines += [
        f'[MCP setup guide](https://github.com/{repository}/blob/{tag}/src/server/services/mcp/README.md) · '
        f'[CNC skills](https://github.com/{repository}/tree/{tag}/.agents/skills)',
        '',
    ]
    if len(re.findall(r'^- `', '\n'.join(lines), re.M)) != len(tools):
        raise ValueError('Some tools have no rendered category')
    return '\n'.join(lines)


def update_notes(body: str, summary: str, tag: str, count: int, repository: str) -> str:
    asset = f'https://github.com/{repository}/releases/download/{tag}/MCP-TOOLS.md'
    section = (
        f'{BEGIN}\n'
        f'<details>\n<summary><h2>MCP tools ({count})</h2></summary>\n\n'
        f'[Download the copyable Markdown list]({asset}).\n\n'
        f'{summary.split(chr(10), 2)[2].rstrip()}\n\n'
        f'</details>\n{END}'
    )
    if BEGIN in body or END in body:
        if body.count(BEGIN) != 1 or body.count(END) != 1:
            raise ValueError('Malformed generated MCP tooling section in release notes')
        body = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), section, body, flags=re.S)
    else:
        body = body.rstrip() + '\n\n' + section
    return body.rstrip() + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--notes-input', type=Path)
    parser.add_argument('--notes-output', type=Path)
    parser.add_argument('--repository', required=True)
    args = parser.parse_args()
    if bool(args.notes_input) != bool(args.notes_output):
        parser.error('--notes-input and --notes-output must be supplied together')
    tools = collect_tools()
    summary = render(args.tag, tools, args.repository)
    args.output.write_text(summary)
    if args.notes_input:
        args.notes_output.write_text(update_notes(args.notes_input.read_text(), summary, args.tag, len(tools), args.repository))
    print(f'Generated {args.output} with {len(tools)} tools')


if __name__ == '__main__':
    main()
