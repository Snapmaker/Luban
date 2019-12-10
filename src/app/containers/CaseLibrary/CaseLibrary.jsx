import classNames from 'classnames';
// import _ from 'lodash';
// import { hashHistory } from 'react-router-dom';
import React, { PureComponent } from 'react';
// import { Link, withRouter } from 'react-router-dom';
// import CaseConfig from './CaseConfig';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './index.styl';

// const mapSectionPathToId = (path = '') => {
//     return camelCase(path.split('/')[0] || '');
// };

class CaseLibrary extends PureComponent {
    static propTypes = {
        // ...withRouter.propTypes
        history: PropTypes.string
    };

    state = {

    }

    actions = {
        loadCase3DP: () => this.props.history.push({
            pathname: '/detail',
            state: {
                id: 3
            }
        })
    }

    render() {
    // console.log(CaseConfig);
        return (
            <div className={styles.caselibrary}>

                <div className={classNames(styles.container, styles.usecase)}>
                    <h2 className={styles.mainTitle}>
                        {i18n._('Use Case')}
                    </h2>
                    <div className={styles.columns}>
                        <button
                            type="button"
                            className={styles.column}
                            onClick={this.actions.loadCase3DP}
                        >
                            <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            <div className={styles.cardtext}>
                                <h4>Leopard</h4>
                                <p>by Snapmaker</p>
                            </div>
                        </button>
                        <div className={styles.column}>
                            <img className={styles.imgIcon} src="../../images/usercase/cnc01.jpg" alt="" />
                            <div className={styles.cardtext}>
                                <h4>Leopard</h4>
                                <p>by Snapmaker</p>
                            </div>
                        </div>
                        <div className={styles.column}>
                            <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            <div className={styles.cardtext}>
                                <h4>Leopard</h4>
                                <p>by Snapmaker</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={classNames(styles.container, styles.videoTutorials)}>
                    <h2 className={styles.mainTitle}>
                        {i18n._('Video Tutorials')}
                    </h2>
                    <div className={styles.columns}>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/usercase/3d01.jpg" alt="" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default (CaseLibrary);
