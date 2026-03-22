/**
 * Post-process AI engine responses for clean QQ display.
 * Strips Markdown formatting. Preserves code blocks and inline code.
 */
export function cleanMarkdown(text) {
    // Extract code blocks to protect them
    const codeBlocks = [];
    let processed = text.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `\x00CODEBLOCK_${codeBlocks.length - 1}\x00`;
    });
    // Extract inline code
    const inlineCodes = [];
    processed = processed.replace(/`[^`\n]+`/g, (match) => {
        inlineCodes.push(match);
        return `\x00INLINE_${inlineCodes.length - 1}\x00`;
    });
    // Headers → plain text with indicators
    processed = processed.replace(/^#{1,2}\s+(.+)$/gm, '== $1 ==');
    processed = processed.replace(/^#{3,6}\s+(.+)$/gm, '-- $1');
    // Bold
    processed = processed.replace(/\*\*(.+?)\*\*/g, '$1');
    processed = processed.replace(/__(.+?)__/g, '$1');
    // Italic
    processed = processed.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '$1');
    processed = processed.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1');
    // Strikethrough
    processed = processed.replace(/~~(.+?)~~/g, '$1');
    // Unordered list markers
    processed = processed.replace(/^[\s]*[-*]\s+/gm, '  · ');
    // Horizontal rules
    processed = processed.replace(/^[-*_]{3,}\s*$/gm, '───────────────');
    // Restore inline code
    processed = processed.replace(/\x00INLINE_(\d+)\x00/g, (_, i) => inlineCodes[Number(i)]);
    // Restore code blocks
    processed = processed.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);
    return processed;
}
