import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';

import styles from './index.styl';

class LaserState extends PureComponent {
    static propTypes = {
        laserFocalLength: PropTypes.number
    };


    render() {
        const { laserFocalLength } = this.props;
        return (
            <div className="container-fluid px-0">
                <div className="row">
                    <div className="col-sm-6">
                        <div className={styles['color-grey-color']}>{i18n._('Laser Focus')}</div>
                        <div>{laserFocalLength} mm</div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { laserFocalLength } = machine;

    return {
        laserFocalLength
    };
};


export default connect(mapStateToProps)(LaserState);
