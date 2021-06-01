import React, { useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import PropTypes from 'prop-types';
import { PAGE_PROCESS } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import SvgIcon from '../../components/SvgIcon';

import i18n from '../../../lib/i18n';
import styles from './styles.styl';

const CreateToolPath = ({ headType, setTitle, setDisplay }) => {
    const page = useSelector(state => state[headType]?.page, shallowEqual);
    const toolPathTypes = useSelector(state => state[headType]?.toolPathGroup?.getToolPathTypes(), shallowEqual);
    const dispatch = useDispatch();
    const actions = {
        createToolPath() {
            dispatch(editorActions.createToolPath(headType));
        }
    };
    // const fastCreateToolPath = () => dispatch(editorActions.fastCreateToolPath(headType));
    useEffect(() => {
        setTitle(i18n._('Create Toolpath'));
        setDisplay(page === PAGE_PROCESS);
    }, []); // << super important array
    useEffect(() => {
        setDisplay(page === PAGE_PROCESS);
    }, [page]);
    return (
        <div>
            <div className="clearfix" tyle={{ height: '20px', textAlign: 'center' }}>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={actions.createToolPath}
                    style={{ display: 'block', width: '100%' }}
                    disabled={toolPathTypes.length === 0}
                >
                    {i18n._('Create Toolpath')}
                </button>
                <div style={{ marginTop: '10px', height: '20px', textAlign: 'center' }}>
                    <SvgIcon
                        name="Information"
                        size={18}
                        color="#979899"
                        className={styles['focus-icon']}
                    />

                    <div style={{
                        display: 'inline-block',
                        color: '#979899',
                        fontSize: '14px',
                        fontFamily: 'Roboto-Regular, Roboto',
                        height: '19px',
                        lineHeight: '19px',
                        marginLeft: '9px'
                    }}
                    >
                        {i18n._('Select Object to Create Toolpath')}
                    </div>
                </div>
            </div>
        </div>
    );
};
CreateToolPath.propTypes = {
    setTitle: PropTypes.func,
    headType: PropTypes.string,
    setDisplay: PropTypes.func
};
export default CreateToolPath;
