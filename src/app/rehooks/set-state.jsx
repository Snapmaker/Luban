import { useState, useCallback } from 'react';

function useSetState(initial = {}) {
    const [state, saveState] = useState(initial);
    const setState = useCallback((newState) => {
        console.log('useSetState');
        saveState(prev => ({ ...prev, ...newState }));
    }, []);

    return [state, setState];
}
export default useSetState;
