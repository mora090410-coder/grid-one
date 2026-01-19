
export const getContrastYIQ = (hex: string): 'black' | 'white' => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'black' : 'white';
};

export const ensureMinLuminance = (hex: string, minLum: number = 0.6): string => {
    const cleanHex = hex.replace('#', '');
    let r = parseInt(cleanHex.substring(0, 2), 16);
    let g = parseInt(cleanHex.substring(2, 4), 16);
    let b = parseInt(cleanHex.substring(4, 6), 16);

    // Simple relative luminance
    const getLum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    let lum = getLum(r, g, b);
    let loopCount = 0;

    // Brighten loop
    while (lum < minLum && loopCount < 20) {
        r = Math.min(255, r + 15);
        g = Math.min(255, g + 15);
        b = Math.min(255, b + 15);
        lum = getLum(r, g, b);
        loopCount++;
    }

    return `rgb(${r}, ${g}, ${b})`;
};

export const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
};
