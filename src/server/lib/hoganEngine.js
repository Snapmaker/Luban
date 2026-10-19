/*
 * Express view engine for Hogan templates.
 *
 * This replaces consolidate, which Luban used only for its hogan renderer.
 * consolidate requires each of the forty template engines it supports by
 * name inside the render functions; webpack resolves every one of those
 * requires at build time and all but hogan.js are absent, so consolidate
 * cannot be compiled into the server bundle. What Luban needs from it is
 * small: read the template (cached when Express has 'view cache' enabled),
 * compile it once, and render it with the locals Express passes in. The
 * behaviour matches consolidate's hogan renderer: a UTF-8 BOM is stripped,
 * the Express options object doubles as Hogan's compile options and as the
 * render context, and `options.partials` is handed to Hogan as-is.
 */
import fs from 'fs';
import Hogan from 'hogan.js';

const compiled = new Map();

const render = (template, options, callback) => {
    let html;
    try {
        html = template.render(options, options.partials);
    } catch (err) {
        callback(err);
        return;
    }
    callback(null, html);
};

/**
 * Render the Hogan template at `filePath` with `options` as the context.
 * Signature as Express expects from `app.engine()`.
 */
export default function hoganEngine(filePath, options, callback) {
    const cached = options.cache ? compiled.get(filePath) : undefined;
    if (cached) {
        render(cached, options, callback);
        return;
    }
    fs.readFile(filePath, 'utf8', (err, str) => {
        if (err) {
            callback(err);
            return;
        }
        let template;
        try {
            template = Hogan.compile(str.replace(/^\uFEFF/, ''), options);
        } catch (compileErr) {
            callback(compileErr);
            return;
        }
        if (options.cache) {
            compiled.set(filePath, template);
        }
        render(template, options, callback);
    });
}
