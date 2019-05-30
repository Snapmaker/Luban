
export const RED = '#e93100';
export const GREEN = '#22ac38';
export const BLUE = '#00b7ee';

export function toDigital(hex) {
    let digital = 0;
    for (let i = 1; i < 7; i++) {
        if (hex[i] >= 'A') {
            digital = digital * 10 + (hex - 'A' + 10);
        } else {
            digital = digital * 10 + (hex - '0');
        }
    }
    return digital;
}
