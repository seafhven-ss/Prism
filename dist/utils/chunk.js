/**
 * QQ message length limit is ~4500 characters.
 * We use 4400 as the base limit, leaving room for the [Part NN/NN] header.
 */
const MAX_MESSAGE_LENGTH = 4400;
/**
 * Split a long text into chunks suitable for QQ messages.
 */
export function chunkText(text, maxLength = MAX_MESSAGE_LENGTH) {
    if (text.length <= maxLength) {
        return [text];
    }
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }
        let splitIndex = remaining.lastIndexOf('\n', maxLength);
        if (splitIndex < 1) {
            splitIndex = remaining.lastIndexOf(' ', maxLength);
        }
        if (splitIndex < 1) {
            splitIndex = maxLength;
        }
        chunks.push(remaining.slice(0, splitIndex));
        remaining = remaining.slice(splitIndex).trimStart();
    }
    return chunks.filter((c) => c.length > 0);
}
/**
 * Add part indicators to multi-chunk messages.
 */
export function formatChunks(chunks) {
    if (chunks.length === 1) {
        return chunks;
    }
    return chunks.map((chunk, index) => {
        const header = `[Part ${index + 1}/${chunks.length}]\n`;
        return header + chunk;
    });
}
