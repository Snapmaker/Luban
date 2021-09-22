import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../../lib/i18n';

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
                        <div className={styles['color-grey-color']}>{i18n._('key_ui/widgets/Connection/LaserState_Laser Height')}</div>
                        <div>
                            {laserFocalLength !== null ? `${laserFocalLength.toFixed(3)} mm` : i18n._('key_ui/widgets/Connection/LaserState_Unknown')}
                        </div>
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
