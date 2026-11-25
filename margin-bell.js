// Measure the typed glyph on its laid-out row, including the paper roll's
// horizontal scale. DOM ranges use the editor's UTF-16 offsets.
const ruler = document.createElement('canvas').getContext('2d');
const graphemes = new Intl.Segmenter();

function prefixOnRow(line, point, offset, middle) {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    walker.currentNode = point;
    const run = document.createRange();
    let width = 0;
    for (let node = point; node; node = walker.previousNode()) {
        if (node.parentElement.closest('.ink-heading-marker')) continue;
        run.selectNodeContents(node);
        if (node === point) run.setEnd(node, offset);
        let earlierRow = false;
        for (const rect of run.getClientRects()) {
            if (rect.top <= middle && rect.bottom > middle) width += rect.width;
            else if (rect.bottom <= middle && rect.height > 0) earlierRow = true;
        }
        if (earlierRow) return {width, firstRow: false};
    }
    return {width, firstRow: true};
}

export function crossedBellPoint(value, start, findPoint) {
    if (!value || /[\r\n]/.test(value) ||
        (value.length > 1 && graphemes.segment(value).containing(0).segment !== value)) return false;

    const range = document.createRange();
    range.setStart(...findPoint(start));
    range.setEnd(...findPoint(start + value.length));
    const glyph = Array.from(range.getClientRects()).find(rect => rect.width > 0 && rect.height > 0);
    if (!glyph) return false;

    if (range.startContainer.nodeType !== Node.TEXT_NODE) return false;
    const element = range.startContainer.parentElement;
    const line = element.closest('.ink-roll-visual-line, .ink-roll-rest, .ink-line');
    if (!line || !ruler) return false;
    const lineStyle = getComputedStyle(line);
    const font = getComputedStyle(element);
    ruler.font = [font.fontStyle, font.fontWeight, font.fontSize, font.fontFamily].join(' ');
    const paddingLeft = parseFloat(lineStyle.paddingLeft);
    const paddingRight = parseFloat(lineStyle.paddingRight);
    const width = parseFloat(lineStyle.width);
    const bounds = line.getBoundingClientRect();
    const boxWidth = lineStyle.boxSizing === 'border-box' ? width : width + paddingLeft + paddingRight;
    if (!(boxWidth > 0)) return false;
    const scale = bounds.width / boxWidth;
    const pitch = ruler.measureText('0').width * scale;
    if (!(pitch > 0)) return false;

    // Typing into a bidirectional run can move its caret toward either edge.
    // Sum the logical prefix on this visual row to locate the carriage.
    const prefix = prefixOnRow(line, range.startContainer, range.startOffset, (glyph.top + glyph.bottom) / 2);
    const indent = prefix.firstRow ? parseFloat(lineStyle.textIndent) || 0 : 0;
    const available = bounds.width - (paddingLeft + paddingRight + indent) * scale;
    // Enter the warning zone when seven whole character cells still fit.
    // Chromium rounds inline coordinates to 1/64 of a CSS pixel.
    const threshold = available - 8 * pitch + scale / 64;
    return prefix.width <= threshold && prefix.width + glyph.width > threshold;
}
