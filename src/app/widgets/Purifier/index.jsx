import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Purifier from './Purifier';
import { createDefaultWidget } from '../../components/SMWidget';
import i18n from '../../lib/i18n';


class PurifierWidget extends PureComponent {
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
        this.props.setTitle(i18n._('Air Purifier'));
    }

    render() {
        return (
            <div>
                <Purifier
                    widgetId={this.props.widgetId}
                    setDisplay={this.props.setDisplay}
                />
            </div>
        );
    }
}

export default createDefaultWidget(PurifierWidget);
