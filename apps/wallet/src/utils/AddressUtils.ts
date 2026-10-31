type TruncateOptions = {
    start?: number;
    end?: number;
    separator?: string;
    keepPrefix?: boolean;
};

export function truncateHash(
    value?: string | null,
    { start = 4, end = 4, separator = "...", keepPrefix = true }: TruncateOptions = {}
): string {
    if (!value) return "";
    const prefix = keepPrefix && value.startsWith("0x") ? "0x" : "";
    const body = value.slice(prefix.length);
    if (body.length <= start + end) return value;
    return `${prefix}${body.slice(0, start)}${separator}${body.slice(body.length - end)}`;
}