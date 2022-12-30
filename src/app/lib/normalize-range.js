// Normalize the value by bringing it within the range.
// If value is greater than max, max will be returned.
// If value is less than min, min will be returned.
// Otherwise, value is returned unaltered. Both ends of this range are inclusive.
export const limit = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

// Returns true if value is within the range, false otherwise.
// It defaults to inclusive on both ends of the range, but that can be changed by
// setting minExclusive and/or maxExclusive to a truthy value.
export const test = (value, min, max, minExclusive, maxExclusive) => {
    return !(
        value < min
        || value > max
        || (maxExclusive && (value === max))
        || (minExclusive && (value === min))
    );
};

export const limitStringLength = (string, maxLength) => {
    const length = string.length;
    if (length > maxLength && maxLength > 4) {
        const prefixLength = maxLength > 10 ? maxLength - 10 : 1;
        string = `${string.slice(0, prefixLength)}...${string.slice(prefixLength + 3 - maxLength)}`;
    }
    return string;
};

/**
 * Split name into 2 parts: prefix + suffix.
 *
 * @param name
 * @param suffixLength
 */
export const normalizeNameDisplay = (name, suffixLength = 7) => {
    if (!name || name.length <= suffixLength) {
        return {
            prefixName: name,
            suffixName: '',
        };
    }
    const prefixName = name.slice(0, name.length - suffixLength);
    const suffixName = name.slice(-suffixLength);
    return {
        prefixName,
        suffixName,
    };
};

export default {
    limit,
    test,
    limitStringLength,
    normalizeNameDisplay,
};
