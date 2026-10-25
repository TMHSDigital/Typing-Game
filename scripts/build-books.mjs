// Builds books/<id>.json from public-domain plain-text editions. Run by
// hand when the book list changes: node scripts/build-books.mjs
//
// Each file holds { id, title, author, chapters: [{ title, pages }] }. Pages
// are typed one per run in the Books category: paragraphs separated by a new
// line, about PAGE_LENGTH characters, in characters a US keyboard can type.
// The license header and footer of the source edition are not kept.
import fs from 'node:fs';

const PAGE_LENGTH = 700;

// heading: a line that starts a chapter. Lines that match but are followed
// by little text (a table of contents) are skipped.
const BOOKS = [
    {
        id: 'alice',
        number: 11,
        title: "Alice's Adventures in Wonderland",
        author: 'Lewis Carroll',
        heading: /^CHAPTER [IVXL]+\.$/,
    },
    {
        id: 'carol',
        number: 46,
        title: 'A Christmas Carol',
        author: 'Charles Dickens',
        heading: /^STAVE [IVX]+:/,
    },
    {
        id: 'time-machine',
        number: 35,
        title: 'The Time Machine',
        author: 'H. G. Wells',
        heading: /^ ?[IVXL]+\.$/,
    },
    {
        id: 'sherlock',
        number: 1661,
        title: 'The Adventures of Sherlock Holmes',
        author: 'Arthur Conan Doyle',
        heading: /^[IVXL]+\. [A-Z][A-Z’'. -]+$/,
    },
    {
        id: 'frankenstein',
        number: 84,
        title: 'Frankenstein',
        author: 'Mary Shelley',
        heading: /^(Letter|Chapter) \d+$/,
    },
    {
        id: 'pride',
        number: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        heading: /^(CHAPTER [IVXL]+\.?|Chapter [IVXL]+\.\]?)$/,
    },
];

// Plain characters for the ones a US keyboard does not have.
const REPLACEMENTS = [
    [/[‘’]/g, "'"],
    [/[“”]/g, '"'],
    [/[—–]/g, '-'],
    [/…/g, '...'],
    [/æ/g, 'ae'],
    [/Æ/g, 'Ae'],
    [/œ/g, 'oe'],
    [/½/g, '1/2'],
    [/£/g, 'L'],
    [/[_·]/g, ''],
];

function plain(text) {
    let result = text;
    for (const [pattern, replacement] of REPLACEMENTS)
        result = result.replace(pattern, replacement);
    // Accented letters lose the accent; anything else outside ASCII is dropped.
    result = result.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return result.replace(/[^\x20-\x7e]/g, '');
}

function chapterTitle(line) {
    let title = plain(line.trim().replace(/\s+/g, ' ')).replace(/[.\]:]+$/, '');
    // All capitals become title case, except the chapter number.
    if (!/[a-z]/.test(title)) {
        title = title
            .split(' ')
            .map((word, n, words) => {
                const numbered = n === 0 || /^(STAVE|CHAPTER)$/.test(words[n - 1]);
                if (numbered && /^[IVXL]+[.:]?$/.test(word)) return word;
                return word[0] + word.slice(1).toLowerCase();
            })
            .join(' ');
    }
    return /^[IVXL]+$/.test(title) ? `Chapter ${title}` : title;
}

function paragraphs(text) {
    return text
        .replace(/\[Illustration[^\]]*\]/g, '')
        .split(/\n\s*\n/)
        .map((block) => plain(block.replace(/^\s*[IVXL]+\.\s*$/gm, '').replace(/\s+/g, ' ')).trim())
        .filter((block) => /[A-Za-z]/.test(block) && !/^THE END\.?$/i.test(block));
}

// Long paragraphs are cut at sentence ends, then pieces are grouped into
// pages of up to PAGE_LENGTH characters.
function pages(blocks) {
    const pieces = [];
    for (const block of blocks) {
        let rest = block;
        while (rest.length > PAGE_LENGTH) {
            const window = rest.slice(0, PAGE_LENGTH);
            const cut = Math.max(
                window.lastIndexOf('. '),
                window.lastIndexOf('? '),
                window.lastIndexOf('! ')
            );
            const end = cut > PAGE_LENGTH / 3 ? cut + 1 : window.lastIndexOf(' ');
            pieces.push(rest.slice(0, end).trim());
            rest = rest.slice(end).trim();
        }
        if (rest) pieces.push(rest);
    }
    const result = [];
    let page = '';
    for (const piece of pieces) {
        if (page && page.length + piece.length + 1 > PAGE_LENGTH) {
            result.push(page);
            page = '';
        }
        page = page ? `${page}\n${piece}` : piece;
    }
    if (page) result.push(page);
    return result;
}

fs.mkdirSync('books', { recursive: true });
for (const book of BOOKS) {
    const response = await fetch(
        `https://www.gutenberg.org/cache/epub/${book.number}/pg${book.number}.txt`
    );
    const lines = (await response.text()).split(/\r?\n/);
    const start = lines.findIndex((line) => /^\*\*\* START OF/.test(line));
    const end = lines.findIndex((line) => /^\*\*\* END OF/.test(line));
    const body = lines.slice(start + 1, end);

    const headings = body
        .map((line, index) => (book.heading.test(line) ? index : -1))
        .filter((index) => index !== -1);
    const chapters = [];
    headings.forEach((index, n) => {
        const text = body.slice(index + 1, headings[n + 1] ?? body.length).join('\n');
        const blocks = paragraphs(text);
        if (blocks.join(' ').length < 500) return; // a table of contents entry
        chapters.push({ title: chapterTitle(body[index]), pages: pages(blocks) });
    });

    const data = { id: book.id, title: book.title, author: book.author, chapters };
    fs.writeFileSync(`books/${book.id}.json`, `${JSON.stringify(data)}\n`);
    const count = chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0);
    console.log(`${book.id}: ${chapters.length} chapters, ${count} pages`);
}
