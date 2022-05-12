interface Options {
    default?: OrderConfig;
    classes?: OrderConfig;
    classExpressions?: OrderConfig;
    interfaces?: OrderConfig;
    typeLiterals?: OrderConfig;
}

type OrderConfig = MemberType[] | SortedOrderConfig | 'never';

interface SortedOrderConfig {
    memberTypes?: MemberType[] | 'never';
    order: 'alphabetically' | 'alphabetically-case-insensitive' | 'as-written';
}

// See below for the more specific MemberType strings
type MemberType = string | string[];

const obj: Options = {
    'classExpressions': {
        memberTypes: ['field', 'constructor', 'method'],
        'order': 'alphabetically-case-insensitive',
    }
}