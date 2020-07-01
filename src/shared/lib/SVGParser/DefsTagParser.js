import BaseTagParser from './BaseTagParser';

class DefsTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        // just hide elements below
        this.attributes.visibility = false;

        // TODO: add pre-processing for ids and xlink:href
    }
}

export default DefsTagParser;
