export const formatMessage = (content: string): string => {
    // Basic formatting: newlines to br
    return content
        .replace(/\n/g, '<br/>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
};
