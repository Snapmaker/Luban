export const NS = {
    HTML: 'http://www.w3.org/1999/xhtml',
    MATH: 'http://www.w3.org/1998/Math/MathML',
    SE: 'http://svg-edit.googlecode.com',
    SVG: 'http://www.w3.org/2000/svg',
    XLINK: 'http://www.w3.org/1999/xlink',
    XML: 'http://www.w3.org/XML/1998/namespace',
    XMLNS: 'http://www.w3.org/2000/xmlns/'
};

export function getReverseNS() {
    const reverseNS = {};
    Object.entries(NS).forEach(([name, URI]) => {
        reverseNS[URI] = name.toLowerCase();
    });
    return reverseNS;
}
