import { throttle } from 'lodash';
import { useEffect, useCallback, useRef } from 'react';


// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
export default <T extends any>(f: (...args: T[]) => void, delay: number) => {
    const fRef = useRef(f);

    useEffect(() => {
        fRef.current = f;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useCallback(
        throttle((...args) => fRef.current(...args), delay),
        [delay]
    );
};
