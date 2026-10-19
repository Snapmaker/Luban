/*
 * Exact-string replacements for a third-party module, applied while webpack
 * reads it, so that a dependency can be compiled into a bundle when one line
 * of it stops that (typically a `require()` of a path built at runtime, which
 * webpack cannot resolve). Each replacement must match, otherwise the build
 * fails: a version bump that moves the patched line is then caught at build
 * time instead of surfacing as a missing module in the packaged app.
 *
 * options: { replacements: [{ from: string, to: string }] }
 */
module.exports = function replaceLoader(source) {
    const { replacements = [] } = this.query || {};
    return replacements.reduce((text, { from, to }) => {
        const at = text.indexOf(from);
        if (at === -1) {
            throw new Error(`${this.resourcePath}: expected to find ${JSON.stringify(from)}; the patch in webpack.config.server.production.js no longer matches this version of the package`);
        }
        return text.slice(0, at) + to + text.slice(at + from.length);
    }, source);
};
