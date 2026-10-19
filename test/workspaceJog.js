// Run with: node test/workspaceJog.js
// All machine, persistence, and presentation dependencies are isolated. The real
// Control -> ControlPanel -> JogPad/JogDistance components run with React hooks.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('tape');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { transformSync } = require('@babel/core');
const lodash = require('lodash');

const base = path.resolve(__dirname, '../src/app/ui/widgets/ConnectionControl');
const sourceCache = new Map();
function loadComponent(filename, mocks) {
    if (!sourceCache.has(filename)) {
        sourceCache.set(filename, transformSync(fs.readFileSync(filename, 'utf8'), {
            filename,
            configFile: false,
            babelrc: false,
            presets: ['@babel/preset-react', '@babel/preset-typescript'],
            plugins: ['@babel/plugin-transform-modules-commonjs']
        }).code);
    }
    const module = { exports: {} };
    const requireMock = (name) => {
        if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
        throw new Error(`Unexpected dependency in isolated UI test: ${name}`);
    };
    vm.runInNewContext(sourceCache.get(filename), { module, exports: module.exports, require: requireMock });
    return module.exports;
}

function mount(saved = {}, fourAxis = true) {
    const commands = [];
    const persisted = [];
    let store = {
        widget: { widgets: { control: { axes: ['x', 'y', 'z', 'b'],
            jog: {
                speed: 1500,
                keypad: false,
                selectedDistance: '5',
                customDistance: 10,
                selectedAngle: '1',
                customAngle: 5,
                ...saved
            } } } },
        workspace: {
            isConnected: true,
            headType: 'cnc',
            workflowStatus: 'idle',
            isMoving: false,
            workPosition: { x: '0', y: '0', z: '0', b: '0', isFourAxis: fourAxis },
            originOffset: { x: 0, y: 0, z: 0, b: 0 },
            server: { executeGcode: code => commands.push(code) }
        }
    };
    const dispatch = (action) => {
        persisted.push(action.value.jog);
        store = { ...store, widget: lodash.merge({}, store.widget, { widgets: { [action.widgetId]: action.value } }) };
    };
    const Input = props => React.createElement('input', props);
    Input.Group = 'input-group';
    const mocks = {
        react: React,
        lodash,
        'lodash/includes': lodash.includes,
        'lodash/map': lodash.map,
        'prop-types': { object: () => null, bool: () => null },
        'react-redux': { useSelector: selector => selector(store), useDispatch: () => dispatch },
        '@snapmaker/luban-platform': { WorkflowStatus: { Unknown: 'unknown', Idle: 'idle', Stopped: 'stopped' } },
        '../../../communication/socket-communication': { controller: { on: () => {}, off: () => {} } },
        '../../../constants': { HEAD_CNC: 'cnc', HEAD_LASER: 'laser', HEAD_PRINTING: '3dp', METRIC_UNITS: 'mm', IMPERIAL_UNITS: 'in' },
        '../../../flux/widget': { actions: { updateWidgetState: (widgetId, key, value) => ({ widgetId, value }) } },
        '../../../flux/workspace': { actions: {} },
        '../../../lib/units': { in2mm: value => value * 25.4, mm2in: value => value / 25.4 },
        '../../../lib/i18n': { _: key => key },
        '../../../machines': { SnapmakerRayMachine: { identifier: 'ray' } },
        '../../../machines/snapmaker-2-toolheads': { L2WLaserToolModule: { identifier: 'laser-2w' } },
        antd: { Row: 'row', Space: 'space', Radio: { Group: 'radio-group', Button: 'radio-button' }, Input },
        '../../components/Buttons': { Button: 'button' },
        '../../components/Select': 'select',
        '../../components/Switch': 'switch',
        '../../components/RepeatButton': 'repeat-button',
        '../../../components/SvgIcon': 'svg-icon',
        './MotionButtonGroup': 'motion-buttons',
        './ABPositionButtonGroup': 'ab-buttons',
        './DisplayPanel': 'display-panel',
        './components/JogPadShortcut': 'shortcuts',
        './styles.styl': { 'rotary-jog-row': 'rotary-jog-row' },
        'namespace-constants': (prefix, names) => Object.fromEntries(names.map(name => [name, name]))
    };
    mocks['../../../lib/hooks/previous'] = loadComponent(path.resolve(base, '../../../lib/hooks/previous.tsx'), mocks);
    mocks['./constants'] = loadComponent(path.join(base, 'constants.js'), mocks);
    for (const name of ['components/JogButton', 'JogPad', 'JogDistance', 'ControlPanel']) {
        mocks[`./${name}`] = loadComponent(path.join(base, `${name}.${name === 'JogDistance' ? 'jsx' : 'tsx'}`), mocks);
    }
    const Control = loadComponent(path.join(base, 'Control.tsx'), mocks).default;
    let renderer;
    act(() => { renderer = create(React.createElement(Control, { widgetId: 'control' })); });
    const panel = () => renderer.root.findByType(mocks['./ControlPanel'].default);
    const groups = () => renderer.root.findAllByType('radio-group');
    const input = title => renderer.root.findAllByType('input').find(node => node.props.title.includes(title));
    return {
        commands,
        persisted,
        renderer,
        panel,
        groups,
        input,
        saved: () => store.widget.widgets.control.jog,
        select: (axis, value) => act(() => groups()[axis === 'B' ? 1 : 0].props.onChange({ target: { value } })),
        edit: (axis, value) => act(() => input(axis === 'B' ? 'Custom angle' : 'Custom distance').props.onChange({ target: { value } })),
        click: (label) => act(() => renderer.root.findAllByType('button').find(node => (
            node.findAllByType('span').some(span => span.children.join('') === label)
        )).props.onClick()),
        action: name => act(() => panel().props.actions[name]()),
        close: () => act(() => renderer.unmount())
    };
}

test('issue 131: first B jog uses the visible custom value with legacy saved settings', (t) => {
    const ui = mount({ selectedAngle: '90', customAngle: 5 });
    t.equal(ui.groups()[1].props.value, '', 'custom angle is selected');
    t.equal(ui.input('Custom angle').props.value, 5, 'visible angle is 5');
    ui.click('B+');
    t.ok(/G0 B5 /.test(ui.commands[0]), 'first click emits 5 degrees, never hidden 90');
    t.deepEqual(ui.commands[0].split('\n'), ['G91', 'G0 B5  F1500', 'G90'], 'positive jog contains only executable lines');
    ui.click('B-');
    t.ok(/G0 B-5 /.test(ui.commands[1]), 'negative jog uses the same displayed angle');
    t.deepEqual(ui.commands[1].split('\n'), ['G91', 'G0 B-5  F1500', 'G90'], 'negative jog contains only executable lines');
    t.equal(ui.saved().selectedAngle, '', 'legacy non-preset value is saved as custom mode');
    t.equal(ui.saved().customAngle, 5, 'custom value is saved separately');
    ui.close();
    t.end();
});

test('custom edits, presets, increment/decrement, and restart keep B display and motion aligned', (t) => {
    let ui = mount();
    ui.select('B', '');
    ui.edit('B', '90');
    ui.click('B+');
    t.ok(/G0 B90 /.test(ui.commands.pop()), 'edited custom value is used immediately');
    ui.select('B', '0.2');
    ui.click('B+');
    t.equal(ui.groups()[1].props.value, '0.2', 'radio selection stays controlled');
    t.ok(/G0 B0.2 /.test(ui.commands.pop()), 'preset overrides remembered custom angle');
    ui.select('B', '');
    ui.edit('B', '5');
    ui.action('increaseCustomAngle');
    t.equal(ui.input('Custom angle').props.value, 6, 'typed 5 increments numerically, not to 51');
    ui.click('B+');
    t.ok(/G0 B6 /.test(ui.commands.pop()), 'incremented angle is sent');
    ui.action('decreaseCustomAngle');
    ui.edit('B', '12.5');
    const saved = ui.saved();
    ui.close();
    ui = mount(saved);
    t.equal(ui.groups()[1].props.value, '', 'custom mode survives restart');
    t.equal(ui.input('Custom angle').props.value, 12.5, 'custom value survives restart');
    ui.click('B+');
    t.ok(/G0 B12.5 /.test(ui.commands.pop()), 'first jog after restart matches displayed custom value');
    ui.edit('B', '0');
    ui.action('decreaseCustomAngle');
    t.equal(ui.input('Custom angle').props.value, 0, 'decrement does not reverse the jog direction');
    ui.edit('B', '10000');
    ui.action('increaseCustomAngle');
    t.equal(ui.input('Custom angle').props.value, 10000, 'increment respects input maximum');
    ui.close();
    t.end();
});

test('XYZ edits and machine-dependent preset visibility use the displayed distance', (t) => {
    const ui = mount({ selectedDistance: '10', customDistance: 2.5 });
    t.equal(ui.groups()[0].props.value, '', '10 mm is not a rotary-mode preset');
    ui.click('Z+');
    t.ok(/G0 Z2.5 /.test(ui.commands.pop()), 'hidden distance preset cannot override visible custom input');
    ui.edit('XYZ', '0.05');
    ui.click('Z-');
    t.ok(/G0 Z-0.05 /.test(ui.commands.pop()), 'XYZ custom edit is used immediately');
    ui.select('XYZ', '1');
    ui.click('X+');
    t.ok(/G0 X1 /.test(ui.commands.pop()), 'XYZ preset change is used immediately');
    ui.select('XYZ', '');
    t.equal(ui.input('Custom distance').props.value, '0.05', 'switching back preserves custom distance');
    const saved = ui.saved();
    ui.close();
    const reboot = mount(saved);
    reboot.click('Z+');
    t.ok(/G0 Z0.05 /.test(reboot.commands.pop()), 'custom distance survives restart');
    reboot.close();
    const linear = mount({ selectedDistance: '10' }, false);
    linear.click('Z+');
    t.ok(/G0 Z10 /.test(linear.commands.pop()), '10 mm remains a valid three-axis preset');
    t.equal(linear.groups().length, 1, 'B controls are absent in three-axis mode');
    linear.close();
    t.end();
});

test('rotary jog buttons occupy their own row, separated from Z', (t) => {
    const ui = mount();
    const rotary = ui.renderer.root.findAllByType('row').find(row => row.props.className === 'rotary-jog-row');
    const labels = rotary.findAllByType('span').map(span => span.children.join(''));
    t.deepEqual(labels, ['B-', 'B', 'B+'], 'rotary row contains only B controls');
    t.notOk(rotary.findAllByType('span').some(span => span.children.join('') === 'Z+'), 'Z+ remains outside the rotary row');
    ui.close();
    t.end();
});
