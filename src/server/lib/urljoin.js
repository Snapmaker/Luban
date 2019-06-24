const normalize = (str) => str
    .replace(/[/]+/g, '/')
    .replace(/\/\?/g, '?')
    .replace(/\/#/g, '#')
    .replace(/:\//g, '://');

function urljoin(...args) {
    const joined = [].slice.call(args, 0).join('/');
    return normalize(joined);
}

export default urljoin;
