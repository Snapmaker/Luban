import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import { MACHINE_SERIES } from '../../../constants';
import {
    CaseConfigOriginal, CaseConfig150,
    CaseConfig250, CaseConfig350,
    CaseConfigA350FourAxis, CaseConfigA250FourAxis
} from './CaseConfig';
import { timestamp } from '../../../../shared/lib/random-utils';
import { actions as projectActions } from '../../../flux/project';
import styles from './styles.styl';

const QuickStart = (props) => {
    const { series, history } = props;
    console.log({ props, history });
    // useState
    const [caseConfig, setCaseConfig] = useState([]);
    const [caseConfigFourAxis, setCaseConfigFourAxis] = useState([]);

    //  method
    const getCaseList = () => {
        switch (series) {
            case MACHINE_SERIES.ORIGINAL.value:
            case MACHINE_SERIES.CUSTOM.value:
                setCaseConfig(CaseConfigOriginal);
                break;
            case MACHINE_SERIES.A150.value:
                setCaseConfig(CaseConfig150);
                break;
            case MACHINE_SERIES.A250.value:
                setCaseConfig(CaseConfig250);
                setCaseConfigFourAxis(CaseConfigA250FourAxis);
                break;
            case MACHINE_SERIES.A350.value:
                setCaseConfig(CaseConfig350);
                setCaseConfigFourAxis(CaseConfigA350FourAxis);
                break;
            default:
                setCaseConfig(CaseConfig150);
                setCaseConfigFourAxis([]);
                break;
        }
    };

    const loadCase = (caseItem) => {
        props.openProject(caseItem.pathConfig, history);
    };

    //  useEffect
    useEffect(() => {
        getCaseList();
    }, []);

    useEffect(() => {
        getCaseList();
    }, [series]);

    return (
        <div className={styles['quick-start-container']}>
            <div className={styles['title-label']}>
                {i18n._('Fast Start')}
            </div>
            <div className={styles['case-list']}>
                {caseConfig.map(caseItem => {
                    return (
                        <div
                            key={caseItem.pathConfig.name + timestamp()}
                            className={styles['case-item']}
                            aria-hidden="true"
                            onClick={() => loadCase(caseItem)}
                        >
                            <div>
                                <img className={styles['case-img']} src={caseItem.imgSrc} alt="" />
                            </div>
                            <div className={styles['case-title']}>
                                {caseItem.title}
                            </div>
                            <span className={styles['tag-icon']}>
                                {i18n._(caseItem.tag_i18n)}
                            </span>
                        </div>
                    );
                })}
                {caseConfigFourAxis?.map(caseFourAxisItem => {
                    return (
                        <div
                            key={caseFourAxisItem.pathConfig.name + timestamp()}
                            className={styles['case-item']}
                            aria-hidden="true"
                            onClick={() => loadCase(caseFourAxisItem)}
                        >
                            <div>
                                <img className={styles['case-img']} src={caseFourAxisItem.imgSrc} alt="" />
                            </div>
                            <div className={styles['case-title']}>
                                {caseFourAxisItem.title}
                            </div>
                            <span className={styles['tag-icon']}>
                                <span style={{ paddingRight: 2 }}>{i18n._('4-axis')}</span>
                                <span>{i18n._(caseFourAxisItem.tag_i18n)}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        series: machine.series
    };
};

const mapDispatchToProps = (dispatch) => ({
    openProject: (headType, history) => dispatch(projectActions.open(headType, history))
});

QuickStart.propTypes = {
    series: PropTypes.string.isRequired,
    openProject: PropTypes.func.isRequired,
    history: PropTypes.object
};
export default connect(mapStateToProps, mapDispatchToProps)(QuickStart);
