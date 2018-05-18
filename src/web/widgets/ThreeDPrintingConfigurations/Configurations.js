import React, { PureComponent } from 'react';


const PRINTING_TYPE_FAST_PRINT = 'FAST_PRINT';
// const PRINTING_TYPE_NORMAL_QUALITY = 'NORMAL_QUALITY';
// const PRINTING_TYPE_HIGH_QUALITY = 'HIGH_QUALITY';
// const PRINTING_TYPE_CUSTOM = 'CUSTOM';


class Configurations extends PureComponent {
    state = {
        configType: PRINTING_TYPE_FAST_PRINT
    };

    render() {
        const state = this.state;

        return (
            <div>
                <p>{state.configType}</p>
            </div>
        );
    }
}

export default Configurations;
