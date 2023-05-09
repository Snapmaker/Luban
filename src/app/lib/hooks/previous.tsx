import { useEffect, useRef } from 'react';

function usePrevious<T>(value: T): T {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

export default usePrevious;
