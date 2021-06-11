import { useState, useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';

import UniApi from '../../lib/uni-api';

// this is an example of hooks plugin
export default function useGetRecoveringProject(headType) {
    const findLastEnvironment = useSelector(state => state?.project[headType].findLastEnvironment, shallowEqual);
    const openedFile = useSelector(state => state?.project[headType].openedFile, shallowEqual);
    UniApi.Window.setOpenedFile(openedFile ? openedFile.name : undefined);

    const [recoveringProject, setRecoveringProject] = useState(findLastEnvironment);

    useEffect(() => {
        if (findLastEnvironment) {
            setRecoveringProject(true);
        }
    }, [findLastEnvironment]);

    return [recoveringProject, setRecoveringProject];
}
