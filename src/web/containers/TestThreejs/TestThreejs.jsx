import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';

class TestThreejs extends Component {
    render() {
        const style = this.props.style;
        return (
            <div style={style}>
                <div>
                    <div id="div1" style={{ float: 'left', 'background': '#e0e0e0', margin: '5px 5px 5px 5px' }}>
                        <p>***** test three js *****</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(TestThreejs);
