import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
// import i18n from '../../lib/i18n';
import Filter from './Filter';
import { createDefaultWidget } from '../../components/SMWidget';
import i18n from '../../lib/i18n';
// import {
// } from '../../constants';


class FilterWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Filter'));
    }

    render() {
        return (
            <div>
                <Filter
                    widgetId={this.props.widgetId}
                    setDisplay={this.props.setDisplay}
                />
            </div>
        );
    }
}

export default createDefaultWidget(FilterWidget);
