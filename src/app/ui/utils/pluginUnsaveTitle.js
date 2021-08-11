import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { actions as projectActions } from '../../flux/project';

export function useUnsavedTitle(headType) {
    const unSaved = useSelector(state => state?.project[headType]?.unSaved, shallowEqual);
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(projectActions.setOpenedFileWithUnSaved(headType, unSaved));
    }, [unSaved]);
}

export default {
    useUnsavedTitle
};
