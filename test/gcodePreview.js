// Exercise the real worker, geometry parser and Redux actions with isolated I/O.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('tape');
const { transformSync } = require('@babel/core');
const THREE = require('three');
const React = require('react');
const { create } = require('react-test-renderer');

const cache = new Map();
function load(relative, mocks) {
    const filename = path.resolve(__dirname, '..', relative);
    if (!cache.has(filename)) {
        cache.set(filename, transformSync(fs.readFileSync(filename, 'utf8'), {
            filename, configFile: false, babelrc: false,
            presets: ['@babel/preset-react', '@babel/preset-typescript'],
            plugins: ['@babel/plugin-transform-modules-commonjs']
        }).code);
    }
    const module = { exports: {} };
    vm.runInNewContext(cache.get(filename), {
        module, exports: module.exports,
        require: name => {
            if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
            if (!name.startsWith('.')) return require(name);
            throw Error(`Unmocked import: ${name}`);
        }
    });
    return module.exports.default;
}

function workerWithReader(readFileToList) {
    const parser = load('src/app/workers/GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace.ts', {
        '../../../shared/lib/gcodeToolPath': require('../src/shared/lib/gcodeToolPath').default,
        '../../constants': { DATA_PREFIX: '/data/Tmp' },
        './index': { readFileToList },
        '../../../shared/lib/math/Vector2': require('../src/shared/lib/math/Vector2')
    });
    return load('src/app/workers/gcodeToArraybufferGeometry.ts', {
        './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace': parser
    });
}

const program = [';header_type: cnc', 'G21', 'G90', 'G0 Z5', 'G1 X10 Y20 Z-0.1 F100'];

test('preview worker reads uploaded CNC from HTTP backend, not luban packaged assets', async (t) => {
    const paths = [];
    const worker = workerWithReader(async url => { paths.push(url); return program; });
    const results = [];
    await new Promise((resolve, reject) => worker({
        func: 'WORKSPACE', gcodeFilename: 'board.cnc', isPreview: true,
        backendOrigin: 'http://127.0.0.1:44025'
    }).subscribe({ next: data => results.push(data), error: reject, complete: resolve }));
    t.deepEqual(paths, ['http://127.0.0.1:44025/data/Tmp/board.cnc']);
    const result = results.find(data => data.status === 'succeed');
    t.ok(result.isDone, 'geometry completes');
    t.equal(result.isPreview, true);
    t.ok(result.value.positions.send.length > 0);
    t.ok(Array.from(result.value.positions.send).every(Number.isFinite));
    t.end();
});

test('worker preserves preview identity and readable reason on file failure', async (t) => {
    const worker = workerWithReader(async () => { throw Error('404: uploaded file missing'); });
    const results = [];
    await new Promise((resolve, reject) => worker({
        func: 'WORKSPACE', gcodeFilename: 'missing.cnc', isPreview: true
    }).subscribe({ next: data => results.push(data), error: reject, complete: resolve }));
    t.equal(results.length, 1);
    t.equal(results[0].status, 'err');
    t.equal(results[0].isPreview, true);
    t.equal(results[0].value, '404: uploaded file missing');
    t.end();
});

test('inline G-code still works without a backend origin or file fetch', async (t) => {
    const worker = workerWithReader(() => { throw Error('unexpected fetch'); });
    const results = [];
    await new Promise((resolve, reject) => worker({ func: 'WORKSPACE', gcode: program.join('\n') })
        .subscribe({ next: data => results.push(data), error: reject, complete: resolve }));
    t.ok(results.some(data => data.status === 'succeed' && data.isDone));
    t.end();
});

test('renderer forwards its backend origin to the worker', (t) => {
    const manager = load('src/app/lib/manager/workerManager.ts', {
        '../../store/local-storage': { machineStore: { get: () => false } },
        '../backend-origin': { getBackendOrigin: () => 'http://127.0.0.1:44025' },
        './ClippingPoolManager.worker': {}, './Pool.worker': {}, './clipperPool.worker': {}
    });
    manager.exec = (method, data) => {
        t.equal(method, 'gcodeToArraybufferGeometry');
        t.equal(data.backendOrigin, 'http://127.0.0.1:44025');
        t.equal(data.gcodeFilename, 'board.cnc');
        t.equal(data.isPreview, true);
    };
    manager.gcodeToArraybufferGeometry({ func: 'WORKSPACE', gcodeFilename: 'board.cnc', isPreview: true }, () => {});
    t.end();
});

test('failed preview exits loading, displays reason, and resets error on retry', async (t) => {
    const stages = { EMPTY: 0, LOADING_GCODE: 1, LOAD_GCODE_SUCCEED: 2, LOAD_GCODE_FAILED: 3 };
    let callback;
    const state = { workspace: { modelGroup: new THREE.Group(), previewModelGroup: new THREE.Group() } };
    const actions = load('src/app/flux/workspace/actions-gcode.ts', {
        '../../api': {}, '../../constants': {}, '../../lib/gaEvent': {}, '../../lib/log': { error: () => {} },
        '../../lib/manager/workerManager': { gcodeToArraybufferGeometry: (data, cb) => { callback = cb; } },
        '../../scene/three-extensions/ThreeUtils': {},
        '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d': {},
        './MachineAgent': {}, './actions-base': { updateState: value => ({ value }) },
        './state': { WORKSPACE_STAGE: stages, ConnectionType: {} }
    });
    const dispatch = action => (typeof action === 'function'
        ? action(dispatch, () => state) : Object.assign(state.workspace, action.value));
    await dispatch(actions.renderPreviewGcodeFile({ uploadName: 'board.cnc' }));
    // The failure must not clobber a separately rendered workspace.
    state.workspace.renderState = 'rendered';
    state.workspace.stage = stages.LOAD_GCODE_SUCCEED;
    callback({ status: 'err', isPreview: true, value: '404: uploaded file missing' });
    t.equal(state.workspace.previewRenderState, 'failed');
    t.equal(state.workspace.previewStage, stages.LOAD_GCODE_FAILED);
    t.equal(state.workspace.renderState, 'rendered');
    t.equal(state.workspace.stage, stages.LOAD_GCODE_SUCCEED);
    const Modal = props => React.createElement('modal', props);
    Modal.Header = 'header'; Modal.Body = 'body'; Modal.Footer = 'footer';
    const Preview = load('src/app/ui/widgets/ConnectionFileTransfer/modals/GCodeFilePreviewModal.tsx', {
        '@snapmaker/luban-platform': { WorkflowStatus: {} },
        'react-redux': { useSelector: selector => selector({ ...state, machine: { size: {} } }), useDispatch: () => dispatch },
        antd: { Spin: 'spinner' },
        '../../../../flux/workspace': { WORKSPACE_STAGE: stages, actions: {} },
        '../../../../flux/workspace/state': { ConnectionType: {} },
        '../../../../lib/i18n': { _: text => text }, '../../../components/Buttons': { Button: 'button' },
        '../../../components/Dropdown': 'dropdown', '../../../components/Menu': 'menu',
        '../../../components/Modal': Modal, '../../../components/SMCanvas': 'canvas',
        '../../../components/SvgIcon': 'icon', '../../CanvasToolbar/SecondaryToolbar': 'toolbar',
        '../../WorkspaceVisualizer/PrintablePlate': function Plate() {}, '../GCodeParams': 'params'
    });
    const view = create(React.createElement(Preview, { gcodeFile: {} }));
    t.equal(view.root.findAllByType('spinner').length, 0);
    t.equal(view.root.findAllByProps({ role: 'alert' }).length, 1);
    t.ok(JSON.stringify(view.toJSON()).includes('404: uploaded file missing'));
    view.unmount();
    await dispatch(actions.renderPreviewGcodeFile({ uploadName: 'board.cnc' }));
    t.equal(state.workspace.previewRenderError, '');
    t.equal(state.workspace.previewRenderState, 'rendering');
    t.end();
});
